const axios = require('axios');
const async = require('async');
const fs = require('fs');
const path = require('path');
// 写入文件操作 promise 实现
const WriteFiles = (path, content) => {
    return new Promise((resolve, reject) => {
        fs.writeFile(
            path,
            content, {
                flag: "a",
                encoding: "utf-8",
            },
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(path);
                }
            }
        );
    });
};


const req = function(url) {
    // console.log('getDatas-start');
    return new Promise(async(resolve, reject) => {
        let config = {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.92 Safari/537.36",
            },
            // responseType: "stream",
        };
        let respone = await axios(url, config);
        resolve(respone.data);
    });
};
// 下载音频
const downloadVoice = (url, paths) => {
    return new Promise(async(resolve, reject) => {
        let config = {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.92 Safari/537.36",
            },
            responseType: "stream",
        };
        let respone = await axios(url, config);
        let fsw = fs.createWriteStream(paths);
        await respone.data.pipe(fsw);
        fsw.on('close', () => {
            // console.log('done!');
            resolve(`${path.basename(paths)}保存完毕！`);
        });
    });
}

function parse(reg, str) {
    let res = {
        title: [],
        url: []
    }
    let temp = str.matchAll(reg);
    for (const item of temp) {
        res.url.push(item[1]);
        item[2] && res.title.push(item[2]);
    }
    temp = null;
    // 返回提取到的链接地址 和 标题名称
    return res;
}
// 获取音频所在的页面地址
const parseType = (url) => {
    return new Promise(async(resolve, reject) => {
        let vioceRes = await req(url);
        // let Reg = /<a href="(http:\/\/mp\.weixin\.qq\.com.*?)"(?: target="_blank".*?)>(.*?)<\/a>/ig;
        let Reg = /<a href="(http:\/\/mp\.weixin\.qq\.com.*?)"(?: target="_blank".*?)>.*?(《.*?)(<\/span>)?<\/a>/ig;
        let voices = parse(Reg, vioceRes);
        console.log(voices);
        Reg = null;
        vioceRes = null;
        resolve(voices);
    });
};
// 获取音频下载地址
const parseVoiceUrl = (url) => {
    return new Promise(async(resolve, reject) => {
        const BASE = 'https://res.wx.qq.com/voice/getvoice?mediaid='
        let res = await req(url);
        let Reg = /{"voice_id":"(.*?)","sn"/ig;
        let mediaid = parse(Reg, res);
        let voiceUrl = BASE + mediaid.url.toString();
        resolve(voiceUrl)
    });
};
const main = async(mainUrl) => {
        let mianTypes = await req(mainUrl);
        // console.log(typeof mianTypes);
        let Reg = /<a href="(http:\/\/mp\.weixin\.qq\.com.*?)"(?: target="_blank".*?)>.*?(《.*?)(<\/span>)?<\/a>/ig;
        let typeUrls = parse(Reg, mianTypes)
        mianTypes = null;
        Reg = null;
        console.log(typeUrls);
        // 循环创建目录
        let Counts = 0;
        typeUrls.title.forEach(item => {
            fs.mkdir(`./weixin/${item}/`, {
                recursive: true,
            }, err => {
                err && console.log(err);
                !err && console.log(`${item} 目录创建成功!`);
                // WriteFiles(`./weixin/${item}/${item}.json`, '[').then(() => {
                //     console.log('文件创建成功！，开始写入数据');
                // });
                WriteFiles(`./weixin/${item}/${item}.json`, '[')
            });
        });

        // 开始获取分类页面地址
        let typeFun = (typeUrl, callback) => {
            let typeTitle = typeUrls.title[Counts++];
            let typePromise = parseType(typeUrl);
            typePromise.then((res) => {
                console.log(`当前是第${Counts}个专辑： ${typeTitle} ，共${typeUrls.title.length}个专辑\n`);
                // let temp = JSON.stringify(res[1]);
                WriteFiles(`./weixin/${typeTitle}/${typeTitle}.json`, `[`);
                // 这里传回去的是提取到的 voice页面地址
                // console.log(res);
                // res={res,typeTitle}
                // let typeObj = {
                //     voiceUrl: res,
                //     voiceType: typeTitle
                // }
                // 添加一个当前音频的专辑信息
                res.voiceType = typeTitle;
                callback(null, res);
            });
        };
        let allTypeFun = (err, results) => {
            console.log('专辑获取完毕，开始保存音频');
            let allTitles = [];
            let allTypes = []
            let allVoices = [];
            Counts = 1;
            results.forEach(item => {
                var len1 = allVoices.length;
                allVoices.push(...(item.url));
                allTitles.push(...(item.title));
                var len2 = allVoices.length;
                var tempArr = Array(len2 - len1).fill(item.voiceType);
                allTypes.push(...tempArr);
                tempArr = null;
            });
            console.log(`共${allVoices.length}个音频需要保存`);

            function voiceFun(voiceUrl, callback) {
                let voicePromise = parseVoiceUrl(voiceUrl);
                voicePromise.then(res => {
                    let temp = {};
                    let index = allVoices.indexOf(voiceUrl);
                    // console.log(`正在保存第${index}个，共${allVoices.length}个`);
                    temp.type = allTypes[index];
                    temp.title = allTitles[index];
                    temp.url = allVoices[index];
                    temp.downloadLink = res;
                    WriteFiles(`./weixin/${temp.type}/${temp.type}.json`, `${JSON.stringify(temp)},`);
                    let voicePath = `./weixin/${temp.type}/${index} ${temp.title}.mp3`;
                    downloadVoice(temp.downloadLink, voicePath).then(voiceMsg => console.log(voiceMsg));
                    callback(null, temp.type);
                })
            }

            function allVoiceFun(err, allResults) {
                allResults.forEach(async(value, i) => {
                    if (i == 0) {
                        WriteFiles(`./weixin/${value}/${value}.json`, `]`);
                    } else if (value != allResults[i - 1]) {
                        WriteFiles(`./weixin/${value}/${value}.json`, `]`);
                    }
                    if (i == allResults.length - 1) {
                        console.log('全部保存完毕！');
                    }

                });
            }
            async.mapLimit(allVoices, 5, voiceFun, allVoiceFun);
        };
        async.mapLimit(typeUrls.url, 3, typeFun, allTypeFun);
    }
    // const startUrl = 'https://mp.weixin.qq.com/s/nfkeVKXxrD1lCCufvxF_-g';
    // const startUrl = 'https://mp.weixin.qq.com/s/HUzCKtr5JlyvdOPfOPrdXQ';
const startUrl = 'https://mp.weixin.qq.com/s/HB1JYK-YlXfN9sBl5qFu5g';
main(startUrl);

