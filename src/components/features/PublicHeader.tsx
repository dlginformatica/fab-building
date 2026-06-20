import { Link } from "@tanstack/react-router";

export function PublicHeader() {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30">
      <div className="container mx-auto flex items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground font-display font-bold">H</div>
          <span className="font-display text-lg font-semibold">HotelOps</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link to="/features" className="rounded-md px-3 py-2 hover:bg-accent" activeProps={{ className: "rounded-md px-3 py-2 bg-accent font-medium" }}>Funzioni</Link>
          <Link to="/manual" className="rounded-md px-3 py-2 hover:bg-accent" activeProps={{ className: "rounded-md px-3 py-2 bg-accent font-medium" }}>Manuale</Link>
          <Link to="/brochure" className="rounded-md px-3 py-2 hover:bg-accent" activeProps={{ className: "rounded-md px-3 py-2 bg-accent font-medium" }}>Brochure</Link>
          <Link to="/auth" className="ml-2 rounded-md border border-border px-3 py-2 hover:bg-accent">Accedi</Link>
          <Link to="/auth" className="rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground hover:opacity-90">Inizia</Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
      HotelOps · Building &amp; Facility Management · <Link to="/manual" className="underline">Manuale</Link> · <Link to="/brochure" className="underline">Brochure</Link> · <Link to="/features" className="underline">Funzioni</Link>
    </footer>
  );
}