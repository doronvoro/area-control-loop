import Link from 'next/link';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  collapsed?: boolean;
}

const sizeMap = {
  sm: { icon: 24, text: 'text-lg' },
  md: { icon: 32, text: 'text-xl' },
  lg: { icon: 48, text: 'text-2xl' },
};

export function Logo({ className = '', showText = true, size = 'md', collapsed = false }: LogoProps) {
  const { icon: iconSize, text: textSize } = sizeMap[size];
  const shouldShowText = showText && !collapsed;

  return (
    <Link
      href="/dashboard"
      className={`flex items-center gap-2 ${className}`}
    >
      <div
        className="flex-shrink-0 text-primary"
        style={{ width: iconSize, height: iconSize }}
      >
        <img
          src="/logo.svg"
          alt="Area Control Loop Logo"
          width={iconSize}
          height={iconSize}
          className="w-full h-full"
        />
      </div>
      {shouldShowText && (
        <span className={`font-bold ${textSize} text-foreground`}>
          Area Control Loop
        </span>
      )}
    </Link>
  );
}
