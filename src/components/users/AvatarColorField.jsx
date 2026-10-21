import React from 'react';
import { Check, Palette } from 'lucide-react';
import { AVATAR_COLORS } from '@/lib/user-avatar';
import UserAvatar from '@/components/common/UserAvatar';

export default function AvatarColorField({ name, value, onChange }) {
  return (
    <fieldset className="avatar-color-field">
      <legend><Palette aria-hidden="true" className="h-3.5 w-3.5" /> Cor do avatar</legend>
      <div className="flex items-center gap-3">
        <UserAvatar user={{ full_name: name, avatar_color: value }} size={36} />
        <div className="avatar-color-options">
          {AVATAR_COLORS.map((color, index) => <button key={color} type="button" aria-label={`Cor ${index + 1} do avatar`} aria-pressed={value === color} style={{ backgroundColor: color }} onClick={() => onChange(color)}>{value === color && <Check aria-hidden="true" className="h-4 w-4" />}</button>)}
        </div>
      </div>
      <p>A inicial aparece quando não há foto. Todas as cores mantêm contraste com a letra branca.</p>
    </fieldset>
  );
}
