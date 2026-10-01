// electron-builder's 7-Zip (24.x) auto-applies the ARM64 branch filter to ARM64
// PE files. The NSIS installer extracts with the older nsis7z plugin, which has
// no ARM64 decoder and silently skips those entries — the Windows arm64
// installer then ships without CourseCollab.exe and its DLLs. Force BCJ2, which
// nsis7z can decode.
module.exports = async function beforePack() {
  if (!process.env.ELECTRON_BUILDER_7Z_FILTER) {
    process.env.ELECTRON_BUILDER_7Z_FILTER = 'BCJ2'
  }
}
