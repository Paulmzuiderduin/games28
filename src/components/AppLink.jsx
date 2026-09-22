import { navigate } from '../lib/router.js';
import { canonicalRoutePath } from '../lib/seo.js';

export default function AppLink({ href, children, className }) {
  const canonicalHref = href.startsWith('/') ? canonicalRoutePath(href) : href;

  return (
    <a
      href={canonicalHref}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(canonicalHref);
      }}
    >
      {children}
    </a>
  );
}
