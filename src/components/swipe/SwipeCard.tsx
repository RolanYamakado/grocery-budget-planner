import { useDrag } from '@use-gesture/react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import type { Recipe } from '../../types';
import { RecipeImage } from '../shared/RecipeImage';

interface SwipeCardProps {
  recipe: Recipe;
  active: boolean;
  stackPosition: number;
  onSwipe: (direction: 'left' | 'right') => void;
}

export function SwipeCard({ recipe, active, stackPosition, onSwipe }: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-18, 18]);
  const likeOpacity = useTransform(x, [20, 120], [0, 1]);
  const nopeOpacity = useTransform(x, [-120, -20], [1, 0]);

  const bind = useDrag(
    ({ active: dragging, movement: [mx], velocity: [vx], direction: [dx] }) => {
      if (dragging) {
        x.set(mx);
        return;
      }
      const shouldSwipe = Math.abs(mx) > 120 || Math.abs(vx) > 0.6;
      if (shouldSwipe) {
        const direction = dx > 0 || mx > 0 ? 'right' : 'left';
        void animate(x, direction === 'right' ? 600 : -600, {
          duration: 0.25,
          onComplete: () => onSwipe(direction),
        });
      } else {
        void animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 });
      }
    },
    { enabled: active, axis: 'x' },
  );

  return (
    <motion.div
      {...(active ? (bind() as Record<string, unknown>) : {})}
      style={active ? { x, rotate, touchAction: 'pan-y' } : undefined}
      animate={!active ? { scale: 1 - stackPosition * 0.04, y: stackPosition * 10 } : undefined}
      className="absolute inset-0 flex select-none flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
    >
      <div className="relative h-56 shrink-0">
        <RecipeImage src={recipe.imageUrl} alt={recipe.name} className="h-full w-full" />
        {active && (
          <>
            <motion.div
              style={{ opacity: likeOpacity }}
              className="absolute top-4 left-4 rounded-lg border-4 border-olive px-3 py-1 text-xl font-extrabold text-olive-dark"
            >
              LIKE
            </motion.div>
            <motion.div
              style={{ opacity: nopeOpacity }}
              className="absolute top-4 right-4 rounded-lg border-4 border-red-500 px-3 py-1 text-xl font-extrabold text-red-500"
            >
              NOPE
            </motion.div>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="text-lg font-bold text-stone-900">{recipe.name}</h2>
        <p className="text-sm text-stone-500">{recipe.description}</p>
        <div className="mt-auto flex flex-wrap gap-1.5">
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{recipe.cuisine}</span>
          {recipe.dietTags.map((tag) => (
            <span key={tag} className="rounded-full bg-olive/10 px-2 py-0.5 text-xs text-olive-dark">
              {tag}
            </span>
          ))}
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{recipe.prepMinutes} min</span>
        </div>
      </div>
    </motion.div>
  );
}
