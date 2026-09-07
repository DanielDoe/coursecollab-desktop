import { type ImgHTMLAttributes } from 'react'

type ImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string
  alt: string
  width?: number
  height?: number
  fill?: boolean
  priority?: boolean
  unoptimized?: boolean
  loader?: (args: { src: string; width: number; quality?: number }) => string
  quality?: number
  sizes?: string
}

export default function Image({
  src,
  alt,
  width,
  height,
  fill,
  priority: _priority,
  unoptimized: _unoptimized,
  loader,
  quality,
  style,
  className,
  ...rest
}: ImageProps) {
  const resolvedSrc =
    loader && width ? loader({ src, width, quality }) : src

  if (fill) {
    return (
      <img
        src={resolvedSrc}
        alt={alt}
        className={className}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...style }}
        {...rest}
      />
    )
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      {...rest}
    />
  )
}
