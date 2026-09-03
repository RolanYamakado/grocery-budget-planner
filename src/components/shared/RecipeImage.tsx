import { useState } from 'react';

interface RecipeImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function RecipeImage({ src, alt, className }: RecipeImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-stone-100 text-4xl ${className ?? ''}`}
        role="img"
        aria-label={alt}
      >
        🍽️
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className ?? ''}`}
    />
  );
}
