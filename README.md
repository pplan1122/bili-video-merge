将 bilibili 客户端下载的离线视频、音频合并，输出为一个新视频

```JavaScript
   //基于node js, 启动node file.js

    // 格式转换convert or 合并merge
    workType: 'merge',

    // 视频和音频编码模式，只对‘格式转换’有效
    videCodec: 'libx264',
    audioCodec: 'libmp3lame',
    // bilibili离线文件所在的文件夹
    filePath: `F:/Users/${username}/video/bilibili`,
    // filePath: 'H:/baiduyunxiazai/shared/S02 2020',
    // 并行数，‘格式转换’为CPU高负载任务，建议不要超过2个。‘合并’是IO高负载，建议不要超过4个
    concurrencyAmount: 2,
    // ffmpeg.exe安装路径
    ffmpegPath: 'C:/Program Files/ffmpeg/bin/ffmpeg.exe',
    // 指定输出路径
    outputFolder: `F:/Users/${username}/video/result`,
```
