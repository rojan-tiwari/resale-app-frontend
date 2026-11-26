import { IMAGE_TYPES, ListingImage, MAX_IMAGE_BYTES } from '../../core/models/listing';

/** A photo in the form: either already on the server, or chosen on this device and not uploaded yet. */
export type PhotoItem =
  | {
      readonly kind: 'saved';
      /** The server's id of the photo; also this item's key. */
      readonly key: string;
      readonly image: ListingImage;
    }
  | {
      readonly kind: 'pending';
      /** A made-up key, unique in the form. */
      readonly key: string;
      readonly file: File;
      /** An object URL for the preview; whoever creates it must revoke it. */
      readonly previewUrl: string;
    };

export interface PhotoSelection {
  /** The files that may be added, in the order they were chosen. */
  readonly accepted: readonly File[];
  /** One sentence per file or reason that was left out, ready to show. */
  readonly problems: readonly string[];
}

const MAX_MB = MAX_IMAGE_BYTES / (1024 * 1024);

/**
 * Checks the files a person chose before they are shown or sent: a supported picture type, not empty, not too big, and room
 * for it in the gallery. This saves a round trip and gives the answer next to the file; the server looks at the real content
 * again and its answer wins (a renamed text file passes here and is refused there).
 *
 * @param room how many more photos the listing can take
 */
export function selectPhotos(files: readonly File[], room: number): PhotoSelection {
  const accepted: File[] = [];
  const problems: string[] = [];
  let leftOut = 0;

  for (const file of files) {
    const name = displayName(file);
    if (!IMAGE_TYPES.includes(file.type)) {
      problems.push(`${name} is not a JPEG, PNG or WebP picture.`);
    } else if (file.size === 0) {
      problems.push(`${name} is empty.`);
    } else if (file.size > MAX_IMAGE_BYTES) {
      problems.push(`${name} is larger than ${MAX_MB} MB.`);
    } else if (accepted.length >= room) {
      leftOut++;
    } else {
      accepted.push(file);
    }
  }

  if (leftOut > 0) {
    problems.push(
      room > 0
        ? `Only ${room} more ${room === 1 ? 'photo fits' : 'photos fit'}, so ${leftOut} ${leftOut === 1 ? 'was' : 'were'} left out.`
        : 'The ad already has the most photos it can hold.',
    );
  }
  return { accepted, problems };
}

/** The file's name for a message: never empty, never long. */
function displayName(file: File): string {
  const name = file.name.trim() || 'A file';
  return name.length > 40 ? `${name.slice(0, 40)}…` : name;
}
