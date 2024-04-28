const username = process.env.USERNAME || process.env.USER;
module.exports = {
    //bilibili离线文件所在的文件夹
    filePath: `F:/Users/${username}/video/bilibili`,
    // 并行数
    concurrencyAmount: 2,
    // ffmpeg.exe路径
    ffmpegPath: 'C:/Program Files/ffmpeg/bin/ffmpeg.exe',
    // 指定输出路径
    outputFolder: `F:/Users/${username}/video/result`,
};
