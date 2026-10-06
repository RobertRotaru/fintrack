-- Profile: a short bio and a photo. The photo itself lives in object storage; only its key is kept here.
ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN avatar_key TEXT;
