import React, { useState } from 'react';
import { avatarColor, avatarInitial } from '@/lib/user-avatar';

export default function UserAvatar({ user, className = '', size = 32 }) {
  const [failedPhoto, setFailedPhoto] = useState('');
  const name = user.full_name || user.seller_name || user.email || 'Usuário';
  const photo = user.photo_url;
  return (
    <span className={`user-avatar ${className}`} role="img" aria-label={`Foto de ${name}`} style={{ width: size, height: size, backgroundColor: avatarColor(user), color: '#ffffff', fontSize: Math.round(size * 0.42) }}>
      {photo && failedPhoto !== photo
        ? <img src={photo} alt="" loading="lazy" decoding="async" onError={() => setFailedPhoto(photo)} />
        : avatarInitial(name)}
    </span>
  );
}
