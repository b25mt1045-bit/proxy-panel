import { Suspense } from "react";

// cacheComponents: the run pages read useParams(), which must sit inside a Suspense boundary.
export default function RunLayout({ children }: LayoutProps<"/runs/[id]">) {
  return <Suspense>{children}</Suspense>;
}
