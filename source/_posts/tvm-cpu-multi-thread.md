---
title: tvm-多线程代码生成和运行
tags:
  - TVM
  - CPP
category:
  - TVM
date: 2023-08-09 15:48:52
---


### 调用链
tvm搜索算子在需要多线程运行的算子，是在codegen阶段时插入`TVMBackendParallelLaunch`的调用。
`TVMBackendParallelLaunch` 是tvm的线程池并行化入口，具体如下
```cpp
/*!
 * \brief The callback function to execute a parallel lambda
 * \param task_id the task id of the function. //这里实际就是线程池线程编码，对应第几个线程
 * \param penv The parallel environment backs the execution. // num_task, sync
 * \param cdata The supporting closure data.
 */
typedef int (*FTVMParallelLambda)(int task_id, TVMParallelGroupEnv* penv, void* cdata);

/*!
 * \brief Backend function for running parallel jobs.
 *
 * \param flambda The parallel function to be launched.
 * \param cdata The closure data. // 可以认为时循环的变量 codegen时生成
 * \param num_task Number of tasks to launch, can be 0, means launch
 *           with all available threads. // codegen 时写入的是0，运行时根据配置写入
 *
 * \return 0 when no error is thrown, -1 when failure happens
 */
int TVMBackendParallelLaunch(FTVMParallelLambda flambda, void* cdata, int num_task);
```

`flambda`的调用在单线程和多线程下略有区别。

单线程运行时
```cpp
if (num_workers == 1) {
    std::atomic<int32_t> sync_counter{0};
    TVMParallelGroupEnv env;
    env.num_task = 1;
    env.sync_handle = &sync_counter;
    (*flambda)(0, &env, cdata);
    return 0;
  }
```
多线程运行时
```cpp
// launcher->Init(flambda, cdata, num_task, need_sync != 0);
this->cdata = cdata;
this->flambda = flambda;
this->env.num_task = num_task;

while (queue->Pop(&task, spin_count)) {
    ICHECK(task.launcher != nullptr);
    TVMParallelGroupEnv* penv = &(task.launcher->env);
    void* cdata = task.launcher->cdata;
    if ((*task.launcher->flambda)(task.task_id, penv, cdata) == 0) {
      task.launcher->SignalJobFinish();
    } else {
      task.launcher->SignalJobError(task.task_id);
    }
  }
```
可以看到 待并行函数中 `TVMParallelGroupEnv* penv` 包含了实际的运行时线程，运行时可以根据这个确定每个线程的工作区间和步长。
`cdata`则是线程运行时需要变量信息，闭包变量。

#### 总结
对要并行的函数，实际上是按照`lambda`表达式的方式生成的。`FTVMParallelLambda` 的输入参数前两个是运行时确定的，第三个是捕获的外部变量。


## codegen 过程

下面验证一下上述的猜测。

codegen过程中，实际上是在遍历`tir Stmt`的AST，因为生成的循环都是基于For的，调用过程也比较简单了。
```cpp
void CodeGenCPU::VisitStmt_(const ForNode* op)  // -> 
CreateParallelLaunch(For(op->loop_var, op->min, op->extent, op->kind, op->body,
                        op->thread_binding, op->annotations),
                    0, std::string("loop_parallel_") + op->loop_var->name_hint.c_str());   // ->
CodeGenCPU::VisitStmt_(const ForNode* op);
```
当遍历到For节点时， 根据属性判断是否并行加速。这里只分析加速场景。此时`parallel_env_.penv == nullptr` 创建多线程调用函数，进入`CreateParallelLaunch`函数。 
然后 再生成 For的遍历逻辑。`this->VisitStmt(body);` 这里的`body`其实还是`For` ，这时候就进入 
```cpp
} else {
      // already in parallel env.
```
前文的猜测也在这里得到验证。
 


```cpp

void CodeGenCPU::VisitStmt_(const ForNode* op) {
  ICHECK(is_zero(op->min));
  if (op->kind == ForKind::kSerial || op->kind == ForKind::kUnrolled) {
    CodeGenLLVM::VisitStmt_(op);
  } else if (op->kind == ForKind::kParallel) {
    if (parallel_env_.penv == nullptr) {
      CreateParallelLaunch(For(op->loop_var, op->min, op->extent, op->kind, op->body,
                               op->thread_binding, op->annotations),
                           0, std::string("loop_parallel_") + op->loop_var->name_hint.c_str());
    } else {
      // already in parallel env.
      ICHECK(parallel_env_.task_id.defined());
      ICHECK(parallel_env_.num_task.defined());
      ICHECK(parallel_env_.penv != nullptr);
      DataType t = op->extent.dtype();
      PrimExpr num_task = cast(t, parallel_env_.num_task);
      PrimExpr task_id = cast(t, parallel_env_.task_id);
      ICHECK(!parallel_env_.in_parallel_loop)
          << "Nested parallel loop is not supported by threadpool, try fuse them instead";
      parallel_env_.in_parallel_loop = true;
      if (parallel_env_.stride_pattern) {
        CreateSerialFor(MakeValue(task_id), MakeValue(op->extent), MakeValue(num_task),
                        op->loop_var, op->body);
      } else {
        PrimExpr step = (op->extent + num_task - make_const(t, 1)) / num_task;
        PrimExpr begin = min(task_id * step, op->extent);
        PrimExpr end = min((task_id + make_const(t, 1)) * step, op->extent);
        CreateSerialFor(MakeValue(begin), MakeValue(end),
                        llvm::ConstantInt::getSigned(GetLLVMType(end), 1), op->loop_var, op->body);
      }
      parallel_env_.in_parallel_loop = false;
      ++parallel_env_.parallel_loop_count;
    }
  } else {
    LOG(FATAL) << "cannot handle for type " << op->kind;
  }
}

/*
    const Stmt& body  For 循环的statement
    int num_task, 这里设置的是0，根据运行时参数确定使用线程
    std::string name
*/
void CodeGenCPU::CreateParallelLaunch(const Stmt& body, int num_task, std::string name) {
  // closure data
  llvm::Function* f =
      llvm::Function::Create(ftype_tvm_parallel_lambda_, llvm::Function::PrivateLinkage,
                             "__tvm_parallel_lambda", module_.get());
  SetTargetAttributes(f);

  // allocate and setup the closure, call the closure. //For 循环内部变量。这里需要声明一下
  Array<Var> vfields = tir::UndefinedVars(body, {});
  uint64_t nbytes;
  TypedPointer cdata = PackClosureData(vfields, &nbytes, "closure_" + name); // 可以认为时循环的变量
#if TVM_LLVM_VERSION >= 90
  auto launch_callee = llvm::FunctionCallee(ftype_tvm_parallel_launch_, RuntimeTVMParallelLaunch());
#else
  auto launch_callee = RuntimeTVMParallelLaunch();
#endif
  llvm::BasicBlock* par_launch_end = CheckCallSuccess(builder_->CreateCall(
      launch_callee,
      {f, builder_->CreatePointerCast(cdata.addr, t_void_p_), ConstInt32(num_task)}));
  // Setup the closure function.
  auto* lambda_entry =
      llvm::BasicBlock::Create(*llvm_target_->GetContext(), "parallel_closure_entry", f);
  builder_->SetInsertPoint(lambda_entry);
  auto it = f->arg_begin();
  llvm::Value* task_id = &(*it++);
  task_id->setName("task_id");
  llvm::Value* penv = &(*it++);
  cdata.addr = builder_->CreatePointerCast(&(*it++), cdata.addr->getType());
  // setup new variable map, swap it with current var context.
  std::unordered_map<const VarNode*, llvm::Value*> new_vmap;
  UnpackClosureData(cdata, vfields, &new_vmap);
  // setup parallel env
  ParallelEnv par_env;
  par_env.task_id = Var("task_id", DataType::Int(32));
  par_env.num_task = Var("num_task", DataType::Int(32));
  new_vmap[par_env.task_id.get()] = task_id;
  new_vmap[par_env.num_task.get()] = builder_->CreateLoad(
      t_int32_,
      builder_->CreateInBoundsGEP(t_tvm_parallel_group_env_, penv, {ConstInt32(0), ConstInt32(1)}),
      "num_task");
  par_env.penv = penv;
  auto new_analyzer = std::make_unique<arith::Analyzer>();
  std::swap(function_, f);
  std::swap(parallel_env_, par_env);
  std::swap(analyzer_, new_analyzer);
  std::swap(var_map_, new_vmap);
  this->VisitStmt(body);
  builder_->CreateRet(ConstInt32(0));
  // swap the var map back, now we are back on track.
  std::swap(var_map_, new_vmap);
  std::swap(analyzer_, new_analyzer);
  std::swap(parallel_env_, par_env);
  std::swap(function_, f);
  ICHECK_NE(par_env.parallel_loop_count, 0) << "Cannot find parallel loop within parallel launch";
  builder_->SetInsertPoint(par_launch_end);
}
```