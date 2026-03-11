import { useLocation, Link } from "react-router-dom";

export default function NotFound() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-4 text-base text-muted-foreground">
          Nothing at{" "}
          <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
            {location.pathname}
          </code>
        </p>
        <Link
          to="/"
          className="text-sm text-primary hover:text-primary/80 underline underline-offset-4"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
