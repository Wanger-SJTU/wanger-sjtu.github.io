---
title: C++调用tensorflow模型
date:   2018-07-02
catalog: true
tags: 
   - tensorflow
---

1. **C++ 和python的混合编程**

   - windows + vs

     1. 新建一个工程，在工程属性中添加如下的几个

        ![](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/C%2B%2B%E8%B0%83%E7%94%A8tensorflow%E6%A8%A1%E5%9E%8B/1.jpg)

        >C:\Users\\[user_name]\Anaconda3\include
        >
        >C:\Users\\[user_name]\Anaconda3\Lib
        >
        >C:\Users\\[user_name]\Anaconda3\libs

        具体路径根据自己python的安装情况确定。

     2.   添加附加依赖项 `pytyhon36.lib`,具体参照自己的文件路径以及python版本

        ![](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/C%2B%2B%E8%B0%83%E7%94%A8tensorflow%E6%A8%A1%E5%9E%8B/2.jpg)

     3. 如果需要在`DEBUG`下运行，需要修改`pyconfig.h`文件，我的电脑上的位置为`C:\Users\chmtt\Anaconda3\include\pyconfig.h` 打开以后在293行，将`python36_d.lib`修改为`python36.lib` 即可。如果直接在`release`下运行无需操作。

     4. 假设需要调用的`python`脚本为

        默认你已经写好`tensorflow`的`python`脚本，并能跑成功。（`tensorflow`的使用不是本文重点） 
        c++需要调用的就是这个`classify.py`里面的`evaluate`函数，传入图片路径，返回分类结果给c++程序

        ```python
        from PIL import Image
        import numpy as np
        import tensorflow as tf
        
        def evaluate(pic):
            image = Image.open(pic)
            image = image.resize([256, 256])
            image_array = np.array(image)
            with tf.Graph().as_default():
                	#里面就是对图像读取模型，预测，得到prediction……
                    max_index = np.argmax(prediction)
                    return max_index
        ```

     5. C++Demo

        ```c++
        #include <Python.h>
        #include <iostream>
        
        
        int main(int argc, char** argv)
        {
            const char* picpath ="/home/pdd/PD/c++/c++python/pic/0.0.jpg";
            Py_Initialize(); 
                if ( !Py_IsInitialized() ) {  
                return -1;  
                }  
                PyRun_SimpleString("import sys");
                PyRun_SimpleString("sys.path.append('./')");
            PyObject* pMod = NULL;
            PyObject* pFunc = NULL;
            PyObject* pParm = NULL;
            PyObject* pRetVal = NULL;
            int iRetVal = -999;
            const  char* modulName="classify";    //这个是被调用的py文件模块名字
            pMod = PyImport_ImportModule(modulName); 
            if(!pMod)
            {
                return -1;
            }
            const char* funcName="evaluate";  //这是此py文件模块中被调用的函数名字
            pFunc = PyObject_GetAttrString(pMod, funcName); 
            if(!pFunc)  
            {   
                return -2;  
            }  
            pParm = PyTuple_New(1);
            PyTuple_SetItem(pParm, 0, Py_BuildValue("s",picpath));//传入的参数，是图片的路径
            pRetVal = PyEval_CallObject(pFunc, pParm);//这里开始执行py脚本
            PyArg_Parse(pRetVal, "i", &iRetVal);//py脚本返回值给iRetVal
            //PyErr_Print();
            std::cout<<iRetVal;
            return iRetVal;
        }
        ```

   - ubuntu 

     安装了`anaconda`, `tensorflow`

     C++ 和 python代码与上面类似。在构建执行文件时

     ```bash
     main:c++python.cpp
         g++ -o out c++python.cpp -I/home/pdd/anaconda3/include/python3.6m -lpython3.6m -L /home/pdd/anaconda3/lib
     
     clean:
         rm -rf *.o 
     ```

     `-I`后面的`/home/pdd/anaconda3/include/python3.6m`有需要的`Python.h`；

     `-lpython3.6m`链接到需要的`libpython3.6m.so`;

     `-L`指出链接的路径。  

     终端输入make。如果提示需要什么`libpython3.6m.so`,就把`/home/pdd/anaconda3/lib`下的`libpython3.6m.*.so`复制到`/usr/lib/`下（`sudo cp ——–`）  此时再次输入make，一切ok！得到out文件，输入./out 

2. 源码编译运行。

   大体的流程如下：

   - 1.使用`tensorflow python API`编写和训练自己的模型，训练完成后，使用`tensorflow saver `将模型保存下来。
   - 2.使用`tensorflow c++ API` 构建新的`session`，读取`python`版本保存的模型，然后使用`session->run()`获得模型的输出。
   - 3.编译和运行基于`tensorflow c++  API`写的代码。

   1. **Ubuntu**
   2. **windows**

