-- A stored random color also covers accounts created by platform administration.
ALTER TABLE nexo.users
ADD COLUMN avatar_color text NOT NULL DEFAULT (
  (ARRAY['#166534','#1d4ed8','#7e22ce','#be185d','#b45309','#0e7490','#4338ca','#9f1239','#0f766e','#334155','#6d28d9','#a21caf'])[1 + floor(random() * 12)::int]
);
-- statement-breakpoint
ALTER TABLE nexo.users ADD CONSTRAINT users_avatar_color_contrast
CHECK (avatar_color = ANY(ARRAY['#166534','#1d4ed8','#7e22ce','#be185d','#b45309','#0e7490','#4338ca','#9f1239','#0f766e','#334155','#6d28d9','#a21caf']));
