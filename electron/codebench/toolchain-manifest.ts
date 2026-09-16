export type PortableToolchainKey =
  | 'x86_64-windows'
  | 'aarch64-windows'
  | 'x86_64-macos'
  | 'aarch64-macos'
  | 'x86_64-linux'
  | 'aarch64-linux'

export type PortableToolchainDriver = 'g++' | 'zig'

export type PortableToolchainArtifact = {
  key: PortableToolchainKey
  version: string
  url: string
  sha256: string
  archive: 'zip' | 'tar.xz'
  /** Portable driver used for student compiles (GNU g++ on Windows x64). */
  driver: PortableToolchainDriver
  /** Path to the C++ driver after extract, relative to the extract root. */
  binary: string
}

const ZIG = '0.15.2'
const WINLIBS = '16.2.0-winlibs-ucrt'

/** Portable C++ toolchains when no system compiler is available. */
export const PORTABLE_TOOLCHAINS: Record<PortableToolchainKey, PortableToolchainArtifact> = {
  'x86_64-windows': {
    key: 'x86_64-windows',
    version: WINLIBS,
    url: 'https://github.com/brechtsanders/winlibs_mingw/releases/download/16.2.0posix-14.0.0-ucrt-r1/winlibs-x86_64-posix-seh-gcc-16.2.0-mingw-w64ucrt-14.0.0-r1.zip',
    sha256: 'c1f52294597c0b73786b2a78eb5d176d89226d2f21875eab75e783a8b1cefcc4',
    archive: 'zip',
    driver: 'g++',
    binary: 'mingw64/bin/g++.exe',
  },
  'aarch64-windows': {
    key: 'aarch64-windows',
    version: ZIG,
    url: `https://ziglang.org/download/${ZIG}/zig-aarch64-windows-${ZIG}.zip`,
    sha256: 'b926465f8872bf983422257cd9ec248bb2b270996fbe8d57872cca13b56fc370',
    archive: 'zip',
    driver: 'zig',
    binary: `zig-aarch64-windows-${ZIG}/zig.exe`,
  },
  'x86_64-macos': {
    key: 'x86_64-macos',
    version: ZIG,
    url: `https://ziglang.org/download/${ZIG}/zig-x86_64-macos-${ZIG}.tar.xz`,
    sha256: '375b6909fc1495d16fc2c7db9538f707456bfc3373b14ee83fdd3e22b3d43f7f',
    archive: 'tar.xz',
    driver: 'zig',
    binary: `zig-x86_64-macos-${ZIG}/zig`,
  },
  'aarch64-macos': {
    key: 'aarch64-macos',
    version: ZIG,
    url: `https://ziglang.org/download/${ZIG}/zig-aarch64-macos-${ZIG}.tar.xz`,
    sha256: '3cc2bab367e185cdfb27501c4b30b1b0653c28d9f73df8dc91488e66ece5fa6b',
    archive: 'tar.xz',
    driver: 'zig',
    binary: `zig-aarch64-macos-${ZIG}/zig`,
  },
  'x86_64-linux': {
    key: 'x86_64-linux',
    version: ZIG,
    url: `https://ziglang.org/download/${ZIG}/zig-x86_64-linux-${ZIG}.tar.xz`,
    sha256: '02aa270f183da276e5b5920b1dac44a63f1a49e55050ebde3aecc9eb82f93239',
    archive: 'tar.xz',
    driver: 'zig',
    binary: `zig-x86_64-linux-${ZIG}/zig`,
  },
  'aarch64-linux': {
    key: 'aarch64-linux',
    version: ZIG,
    url: `https://ziglang.org/download/${ZIG}/zig-aarch64-linux-${ZIG}.tar.xz`,
    sha256: '958ed7d1e00d0ea76590d27666efbf7a932281b3d7ba0c6b01b0ff26498f667f',
    archive: 'tar.xz',
    driver: 'zig',
    binary: `zig-aarch64-linux-${ZIG}/zig`,
  },
}

export function portableToolchainKey(
  platform = process.platform,
  arch = process.arch,
): PortableToolchainKey | null {
  if (platform === 'win32' && arch === 'arm64') return 'aarch64-windows'
  if (platform === 'win32') return 'x86_64-windows'
  if (platform === 'darwin' && arch === 'arm64') return 'aarch64-macos'
  if (platform === 'darwin') return 'x86_64-macos'
  if (platform === 'linux' && arch === 'arm64') return 'aarch64-linux'
  if (platform === 'linux') return 'x86_64-linux'
  return null
}

export function portableToolchainForHost(): PortableToolchainArtifact | null {
  const key = portableToolchainKey()
  return key ? PORTABLE_TOOLCHAINS[key] : null
}
