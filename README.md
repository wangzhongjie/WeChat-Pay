
- a Third-party payment platform(WeChat Pay) API developing By Nodejs+Thinkjs+Mysql
- Nodejs,Thinkjs开发微信支付功能，包含拉起支付、监听微信回调、查询订单、关单等功能

## API
- 拉起支付二维码：wxPay/toPay
- 定时轮询支付结果： wxPay/wxPay/queryOrder
- 关单：wxPay/doCloseOrder

### 拉起支付二维码 

    
**简要描述：** 
用户点击赎买，弹出二维码

**请求URL：** 
- ` wxPay/toPay `
  
**请求方式：**
- POST 

**参数：** 

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|merchant_id |是  |number |商家ID，取登录user id   |
|product_id |是  |number | 商品ID    |
|price     |是  |number | 价格    |


**返回示例**

``` 
{
	"code_url":["weixin://wxpay/bizpayurl?pr=cdx1OaJ"],
	"order_id":"2020042916162340888",
	"code":0,
	"msg":""
}

```

**返回参数说明** 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code_url |string   | 生成二维码的短链接  |
|order_id |string   | 订单ID（本地）  |


**备注** 
order_id 用于定时器访问后端方法时的参数




### 定时轮询支付结果

**请求URL：** 
- ` wxPay/queryOrder `
  
**请求方式：**
- POST 

**参数：** 

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|order_id     |是  |string | 订单ID    |

**返回示例**

``` 
{
	trade_state: 'SUCCESS', 
	trade_state_desc: '支付成功'
}
```

**备注** 
返回的是Promise






### 关单
**简要描述：** 
以下情况需要调用关单接口：
1. 商户订单支付失败需要生成新单号重新发起支付，要对原订单号调用关单，避免重复支付；
2. 系统下单后，用户支付超时，系统退出不再受理，避免用户继续，请调用关单接口。
**注意：订单生成后不能马上调用关单接口，最短调用时间间隔为5分钟**

前端要针对这2种情况进行关单，如果不处理，可能有超出预期的失败错误
参考
> https://pay.weixin.qq.com/wiki/doc/api/native.php?chapter=9_3

**请求URL：** 
- ` wxPay/doCloseOrder `
  
**请求方式：**
- POST 

**参数：** 

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|order_id     |是  |string | 订单ID    |

 **返回示例**

``` 
{
	code: 0, 
	msg: '关单成功'
}

{
	code: 1, 
	msg: '关单失败'
}

```


### deal数据库
| Field           | Type          | Null | Default            | Comment             |
|-----------------|---------------|------|--------------------|---------------------|
| id              | int\(11\)     | NO   | \(NULL\)           |                     |
| order\_id       | varchar\(45\) | NO   | \(NULL\)           | 订单id                |
| product\_id     | int\(11\)     | NO   | \(NULL\)           | 对应商品ID              |
| merchant\_id    | int\(11\)     | NO   | \(NULL\)           | 商家userID,或用户userID  |
| transaction\_id | varchar\(45\) | YES  | \(NULL\)           | 微信支付订单号             |
| price           | double        | NO   | \(NULL\)           | 价格                  |
| price\_last     | double        | NO   | \(NULL\)           | 支付价格                |
| status          | tinyint\(4\)  | YES  | \(NULL\)           | 支付状态 0未支付 1已支付 2已过期 |
| mode            | tinyint\(4\)  | NO   | 0                  | 0微信 1支付宝            |
| prepayBack      | text          | YES  | \(NULL\)           | 微信预支付信息             |
| payBack         | text          | YES  | \(NULL\)           | 微信支付返回信息            |
| queryBack       | text          | YES  | \(NULL\)           | 查询订单返回信息            |
| create\_at      | datetime      | NO   | CURRENT\_TIMESTAMP | 创建时间（下单时间）          |
| update\_at      | datetime      | NO   | CURRENT\_TIMESTAMP | 更新时间（支付时间）          |





## Install dependencies

```
npm install
```

## Start server

```
npm start
```

## Deploy with pm2

Use pm2 to deploy app on production enviroment.

```
pm2 startOrReload pm2.json
```

# License
[MIT](http://opensource.org/licenses/MIT)