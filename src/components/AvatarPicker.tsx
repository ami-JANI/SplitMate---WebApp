import { motion } from 'motion/react';
import { AVATARS, avatarSrc } from '../lib/avatars';
import { useMotion } from '../lib/motion';

/** 4-column grid of the eight avatars; the picked one gets a purple ring and grows a little. */
export function AvatarPicker({ value, onChange }: { value?: string; onChange: (id: string) => void }) {
  const { snappy, reduce } = useMotion();
  return (
    <div role="radiogroup" aria-label="Avatar" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {AVATARS.map((a) => {
        const on = value === a.id;
        return (
          <motion.button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={a.name}
            onClick={() => onChange(a.id)}
            animate={{ scale: on && !reduce ? 1.08 : 1 }}
            transition={snappy}
            style={{
              borderRadius: '50%',
              aspectRatio: '1',
              boxShadow: on ? '0 0 0 3px var(--purple)' : '0 0 0 2px var(--white)',
              overflow: 'hidden',
              maxWidth: 76,
              justifySelf: 'center',
              width: '100%',
            }}
          >
            <img src={avatarSrc(a.id)} alt="" style={{ width: '100%', height: '100%' }} draggable={false} />
          </motion.button>
        );
      })}
    </div>
  );
}
