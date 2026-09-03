import type { Recipe } from '../../types';
import { SwipeCard } from './SwipeCard';

interface SwipeDeckProps {
  cards: Recipe[];
  onSwipe: (recipe: Recipe, direction: 'left' | 'right') => void;
}

const VISIBLE_STACK = 3;

export function SwipeDeck({ cards, onSwipe }: SwipeDeckProps) {
  const visible = cards.slice(0, VISIBLE_STACK);

  return (
    <div className="relative mx-auto h-[26rem] w-full max-w-sm">
      {visible.map((recipe, i) => (
        <div key={recipe.id} className="absolute inset-0" style={{ zIndex: VISIBLE_STACK - i }}>
          <SwipeCard
            recipe={recipe}
            active={i === 0}
            stackPosition={i}
            onSwipe={(direction) => onSwipe(recipe, direction)}
          />
        </div>
      ))}
    </div>
  );
}
