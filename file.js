const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const ffmpeg = require('fluent-ffmpeg');
const CONFIG = require('./CONFIG');

const username = process.env.USERNAME || process.env.USER;
const filepath = CONFIG.filePath
    ? CONFIG.filePath.at(-1) === '/'
        ? CONFIG.filePath.slice(0, -1)
        : CONFIG.filePath
    : path.join('C:', 'Users', username, 'video');

const readFileAsync = promisify(fs.readFile);
const readDir = promisify(fs.readdir);
const readStat = promisify(fs.stat);

function index() {
    let i = 0;
    return {
        inc: () => {
            i = i + 1;
            return i;
        },
        dec: () => {
            i = i - 1;
            return i;
        },
        value: () => i,
    };
}

async function asyncFilter(array, predicate) {
    const res = await Promise.all(array.map((el) => predicate(el)));
    return array.filter((el, i) => res[i]);
}

async function getFolders() {
    const folders = await readDir(filepath);
    const predicate = async (folder) => {
        const stat = await readStat(`${filepath}/${folder}`);
        return stat.isDirectory();
    };
    const res = await asyncFilter(folders, predicate);
    return res;
}

async function correctFile(folder) {
    const files = await readDir(`${filepath}/${folder}`);

    const promises = files.map((file) => {
        if (file.includes('.m4s')) {
            const fpath = path.join(`${filepath}/${folder}`, file);
            const readStream = fs.createReadStream(fpath, {
                encoding: 'hex',
            });
            const writeStream = fs.createWriteStream(`${fpath}.temp`, {
                encoding: 'binary',
                flags: 'a',
            });

            readStream.on('data', async (data) => {
                let buffer;
                if (data.startsWith('303030303030303030')) {
                    buffer = Buffer.from(data.slice(18), 'hex');
                } else {
                    buffer = Buffer.from(data, 'hex');
                }
                writeStream.write(buffer, () => {});
            });

            readStream.on('end', () => {
                writeStream.close();
            });

            return new Promise((resolve, reject) => {
                writeStream.on('finish', () => {
                    fs.unlink(`${filepath}/${folder}/${file}`, (err) => {
                        if (err) console.log('unlink', err);
                    });
                    setTimeout(() => {
                        fs.rename(
                            `${filepath}/${folder}/${file}.temp`,
                            `${filepath}/${folder}/${file}`,
                            (err) => {
                                if (err) {
                                    console.error('Error renaming file:', err);
                                    return;
                                }
                                console.log('File renamed successfully');
                            }
                        );
                        console.log(file, '写入完成，文件已被关闭');

                        resolve();
                    }, 100);
                });

                readStream.on('error', (err) => {
                    console.error('Error reading file:', err);
                    reject(err);
                });
            });
        }
        return null;
    });
    return promises.filter((el) => el !== null);
}

async function mergeFile({ file1, file2, groupTitle, title }) {
    const ffmpegPath =
        CONFIG.ffmpegPath.at(-1) === '/'
            ? CONFIG.ffmpegPath.slice(0, -1)
            : CONFIG.ffmpegPath;
    const outputPath =
        CONFIG.outputFolder.at(-1) === '/'
            ? CONFIG.outputFolder.slice(0, -1)
            : CONFIG.outputFolder;

    return new Promise((resolve, reject) => {
        const process = ffmpeg()
            .setFfmpegPath(ffmpegPath)

            .input(file1)
            .input(file2)
            .audioCodec('copy')
            .videoCodec('copy')
            .on('error', function (err) {
                console.log('An error occurred: ' + err.message);
                console.log(err);
                reject();
            });
        setTimeout(() => {
            process
                .output(`${outputPath}/${groupTitle}-${title}.mp4`)
                .on('end', () => {
                    console.log('Conversion finished', title);
                    resolve();
                })
                .run();
        }, 100);
    });
}

async function prepareMerge(folder) {
    let videoinfo;
    let videos = [];
    const files = await readDir(`${filepath}/${folder}`);
    files.forEach((file) => {
        if (file.includes('.m4s')) {
            const fpath = path.join(`${filepath}/${folder}`, file);
            videos.push(fpath);
        }
    });

    await readFileAsync(`${filepath}/${folder}/.videoInfo`, 'utf-8').then(
        (data) => (videoinfo = data)
    );
    //ffmeg;
    const fileInfo = JSON.parse(videoinfo);

    return {
        file1: videos[0],
        file2: videos[1],
        groupTitle: fileInfo.groupTitle,
        title: fileInfo.title,
    };
}

async function composeAsync(...funcs) {
    // 如果没有传入任何函数，则直接返回一个异步函数，它接受参数并返回参数本身
    if (funcs.length === 0) {
        return async (arg) => arg;
    }
    // 返回一个新的异步函数，该函数将依次执行传入的异步函数，并将它们的结果传递给下一个异步函数
    const composedFunc = funcs.reduce(
        async (a, b) =>
            async (...args) =>
                b(await a(...args))
    );

    return composedFunc;
}

async function beginWork(workflow) {
    const ind = index();
    const folders = await getFolders();

    // 控制并发数量
    const chunkSize =
        typeof +CONFIG.concurrencyAmount === 'number'
            ? +CONFIG.concurrencyAmount
            : 2;
    const chunks = [];

    console.log('start chunk');
    for (let i = 0; i < folders.length; i += chunkSize) {
        chunks.push(folders.slice(i, i + chunkSize));
    }
    for await (const chunk of chunks) {
        console.log('------------');
        const promises = [];
        for await (const folder of chunk) {
            console.log('--#', ind.value(), 'on processing: ', folder);
            const composedFun = await composeAsync(...workflow);
            const res = await composedFun(folder);
            if (res instanceof Array) {
                res.forEach((el) => promises.push(el));
            } else {
                promises.push(res);
            }
            ind.inc();
        }
        await Promise.allSettled(promises);
        console.log('------------');
    }
}

async function a() {
    console.log('-------work starting--------');
    await beginWork([correctFile]);
    console.log('-------starting merge-------');
    await beginWork([prepareMerge, mergeFile]);
    console.log('-------work finished-------');
}

a();
