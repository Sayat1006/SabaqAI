export function Logo({ className = "" }: { className?: string }) {
  return <img src="/img/logo.png" alt="" className={`logo-img object-contain ${className}`} />;
}
