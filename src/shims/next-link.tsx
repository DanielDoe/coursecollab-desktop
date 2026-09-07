import { forwardRef, type AnchorHTMLAttributes } from 'react'
import { Link as RouterLink } from 'react-router-dom'

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string
  replace?: boolean
  prefetch?: boolean
  scroll?: boolean
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, replace, prefetch: _prefetch, scroll: _scroll, ...rest },
  ref,
) {
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
    return <a ref={ref} href={href} {...rest} />
  }

  return <RouterLink ref={ref} to={href} replace={replace} {...rest} />
})

export default Link
