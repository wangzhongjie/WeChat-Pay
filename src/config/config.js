// default config
module.exports = {
    workers: 1,

    // 替换成自己平台的参数
    WX: {
        appid: 'xxxxxxxxxxxx', //公众号appid
        mchid: '1111111111', //商户平台id
        mchkey: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', //微信商户平台api key

        unifiedorder: 'https://api.mch.weixin.qq.com/pay/unifiedorder', //统一下单请求地址
        orderquery: 'https://api.mch.weixin.qq.com/pay/orderquery', //查询订单
        closeorder: 'https://api.mch.weixin.qq.com/pay/closeorder', //关单

        nativeNotifyUrl: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxx', //NATIVE 回调地址
    },
};