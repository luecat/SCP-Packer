# Gugarythm Packer

純靜態、無依賴的 Gugarythm 封包網頁。它在瀏覽器本機把 USC 譜面與音樂打包成 `.ggr`；檔案不會上傳。

## `.ggr` 內容

```text
manifest.json      必要，封包格式與曲目資料
chart.usc          必要，原始 USC 譜面
audio.<extension>  必要，MP3、OGG、WAV、M4A、AAC 或 FLAC
metadata.json      自動生成，包含網頁填寫的曲目資料
cover.<extension>  選填，PNG 或 JPEG 封面；上傳 WebP 會在瀏覽器轉成白底 JPEG
```

完整格式規格請見 [設計文件](docs/superpowers/specs/2026-08-16-gugarythm-package-design.md)。

直接開啟 `index.html`，或以任意靜態伺服器提供此資料夾即可使用。
