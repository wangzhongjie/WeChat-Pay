const Base = require('./base.js')
const xml2js = require('xml2js')
const moment = require('moment')
const axios = require('axios')
const wxUtils = require('./wxUtils')
const { log, error, warn, info } = console

const appid = think.config('WX').appid //公众号id
const mch_id = think.config('WX').mchid //商户平台id
const mchkey = think.config('WX').mchkey //微信商户平台api key

module.exports = class extends Base {

    constructor(ctx) {
        super(ctx)
    }


    //点击支付按钮 去支付
    async toPayAction() {
        // 前端传参
        let {
            merchant_id, // 商户ID
            product_id, // 商品ID
            price, // 价格 (单位：元)
        } = this.post()

        price = parseFloat(price)
        if (price < 0.01) {
            return this.fail('金额要大于等于0.01')
        }

        // 生成订单ID 
        let order_id = moment().format('YYYYMMDDHHmmss') + this.rnd(10000, 99999)
        const nonce_str = wxUtils.createNonceStr() //随机字符串32位以下
        let out_trade_no = order_id //微信会有自己订单号、我们自己的系统需要设置自己的订单号
        let total_fee = wxUtils.getmoney(price_last) // 微信规则：单位为分
        let body = merchant_id + ',' + product_id // 自定义一些内容
        let trade_type = 'NATIVE' // 交易类型，JSAPI--公众号支付、NATIVE--原生扫码支付、APP--app支付
        let spbill_create_ip = this.ctx.ip //当前服务器ip

        // 组合成xml
        const formData = this.mergeXml2pay(appid, body, mch_id, nonce_str, think.config('WX').nativeNotifyUrl, out_trade_no, spbill_create_ip, total_fee, trade_type, mchkey)
        // 调用微信支付URL
        let response = await axios.post(think.config('WX').unifiedorder, formData)
        let backData = response.data

        // xml转json格式
        xml2js.parseString(backData, async (err, json) => {
            if (err) {
                throw new Error("解析xml报错")
            }

            let prepayBack = json.xml // 已转换成正常的json 数据
            if (prepayBack.return_code[0] === 'SUCCESS' && prepayBack.result_code[0] === 'SUCCESS') {
                //给前端返回生成二维码的短链接 和定时查询订单的标识
                this.success({ code_url: prepayBack.code_url, order_id: out_trade_no })

                /**
                 * 入库
                 * 因为要记录是否为未支付订单
                 */
                let dealData = {
                    order_id: out_trade_no,
                    product_id,
                    merchant_id,
                    price,
                    status: 0, //未支付
                }

                let ret = await this.model('deal').thenAdd(dealData, { order_id: dealData.order_id })
                if (ret.type === 'add') {
                    this.echo(0, '存储预交易成功', ret)
                } else {
                    this.echo(1, '预交易已存在', ret)
                }

                // 测试1: 查询订单功能, 后端测试用
                // let timer = setInterval(async () => {
                //     this.queryOrderAction(dealData.order_id).then(ret => {
                //         if (ret.trade_state==='SUCCESS') {
                //             clearInterval(timer)
                //         }
                //     })
                // }, 2000)

                // 测试2: 5分钟后若未支付，调用关单, 后端测试用
                // setTimeout(async ()=>{
                //     await this.doCloseOrderAction(out_trade_no)
                // }, 5*60*3000)
            }
        })
    }

    //监听微信支付成功或失败的回调
    async callbackAction() {
        let { xml } = this.post()

        if (!think.isEmpty(xml)) {
            //校验返回结果 及价格是否一致，防止数据泄漏
            if (xml.result_code[0] === 'SUCCESS') {
                const condition = {
                    order_id: xml.out_trade_no[0]
                }
                const exsitdb = await this.model('deal').where(condition).find()

                if (!think.isEmpty(exsitdb) && xml.total_fee[0] == wxUtils.getmoney(exsitdb.price_last)) {
                    //返回给微信结果
                    const status2wx = `<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>`
                    this.body = status2wx
                    log("通知微信 支付成功！")

                    // 状态改为已支付
                    let num = await this.model('deal').where(condition).update({ status: 1 })
                    if (!num) {
                        this.echo(1, '更新记录失败', num)
                    }
                }
            }

            // 测试3: 支付失败 调用关单 后端测试用
            // if (xml.result_code[0] === 'FAIL') {
            //     await this.doCloseOrderAction(out_trade_no)
            // }
        }
    }

    //查询订单
    async queryOrderAction() {
        const { order_id } = this.post()
        const nonce_str = wxUtils.createNonceStr() //随机字符串32位以下
        const out_trade_no = order_id
        const formData = this.mergeXml2order(appid, mch_id, nonce_str, out_trade_no, mchkey)

        let response = await axios.post(think.config('WX').orderquery, formData)
        let backData = response.data

        // xml转json格式
        xml2js.parseString(backData, async (err, json) => {
            if (err) {
                throw new Error("解析xml报错")
            }
            let ret = json.xml
            if (ret.result_code[0] === 'SUCCESS' && ret.trade_state[0] === 'SUCCESS') {
                //给前端返回查询结果
                this.success({
                    trade_state: ret.trade_state[0],
                    trade_state_desc: ret.trade_state_desc[0]
                })
            } else {
                //给前端返回空
                this.success({
                    trade_state: 0,
                    trade_state_desc: 0
                })
            }
            // 测试4: 支付失败 调用关单 后端测试用
            // if (ret.trade_state[0] === 'PAYERROR' || ret.trade_state[0] === 'REVOKED') {
            //     await this.doCloseOrderAction(out_trade_no)
            // }
        })
    }

    //关单
    async doCloseOrderAction() {
        const { order_id } = this.post()
        const nonce_str = wxUtils.createNonceStr() //随机字符串32位以下
        const out_trade_no = order_id
        const formData = this.mergeXml2order(appid, mch_id, nonce_str, out_trade_no, mchkey)
        let response = await axios.post(think.config('WX').closeorder, formData)
        let backData = response.data

        // xml转json格式
        xml2js.parseString(backData, async (err, json) => {
            if (err) {
                throw new Error("解析xml报错")
            }
            let ret = json.xml
            if (ret.result_code[0] === 'SUCCESS' && ret.result_msg[0] === 'OK') {
                this.success('关单成功')
            } else {
                this.fail('关单失败')
            }
        })
    }

    /**
     * 组合成拉取支付xml格式
     * @param {string} appid 
     * @param {string} body 
     * @param {string} mch_id 
     * @param {string} nonce_str 
     * @param {string} nativeNotifyUrl 
     * @param {string} out_trade_no 
     * @param {string} spbill_create_ip 
     * @param {string} total_fee 
     * @param {string} trade_type 
     * @param {string} mchkey 
     */
    mergeXml2pay(appid, body, mch_id, nonce_str, nativeNotifyUrl, out_trade_no, spbill_create_ip, total_fee, trade_type, mchkey) {
        // 签名加密算法
        let sign = wxUtils.paysignjsapiForNative(appid, body, mch_id, nonce_str, nativeNotifyUrl, out_trade_no, spbill_create_ip, total_fee, trade_type, mchkey)

        let formData = "<xml>";
        formData += "<appid>" + appid + "</appid>"; //appid
        formData += "<body><![CDATA[" + body + "]]></body>"; //商品或支付单简要描述
        formData += "<mch_id>" + mch_id + "</mch_id>"; //商户号
        formData += "<nonce_str>" + nonce_str + "</nonce_str>"; //随机字符串，不长于32位
        formData += "<notify_url>" + nativeNotifyUrl + "</notify_url>"; //支付成功后微信服务器通过POST请求通知这个地址
        formData += "<out_trade_no>" + out_trade_no + "</out_trade_no>"; //订单号
        formData += "<total_fee>" + total_fee + "</total_fee>"; //金额
        formData += "<spbill_create_ip>" + spbill_create_ip + "</spbill_create_ip>"; //ip
        formData += "<trade_type>NATIVE</trade_type>"; //NATIVE会返回code_url ，JSAPI不会返回
        formData += "<sign>" + sign + "</sign>";
        formData += "</xml>";

        return formData
    }

    /**
     * 组合成查询订单等xml格式
     * @param {string} appid 
     * @param {string} mch_id 
     * @param {string} nonce_str 
     * @param {string} out_trade_no 
     * @param {string} mchkey 
     */
    mergeXml2order(appid, mch_id, nonce_str, out_trade_no, mchkey) {
        // 签名加密算法
        let sign = wxUtils.paysignjsapiForQueryOrder(appid, mch_id, nonce_str, out_trade_no, mchkey)

        let formData = "<xml>";
        formData += "<appid>" + appid + "</appid>"; //appid
        formData += "<mch_id>" + mch_id + "</mch_id>"; //商户号
        formData += "<nonce_str>" + nonce_str + "</nonce_str>"; //随机字符串，不长于32位
        formData += "<out_trade_no>" + out_trade_no + "</out_trade_no>"; //订单号
        formData += "<sign>" + sign + "</sign>";
        formData += "</xml>";

        return formData
    }
}