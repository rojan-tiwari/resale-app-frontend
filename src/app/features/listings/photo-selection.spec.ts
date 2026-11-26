import { MAX_IMAGE_BYTES } from '../../core/models/listing';
import { selectPhotos } from './photo-selection';

function file(name: string, type: string, size = 1000): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('selectPhotos', () => {
  it('accepts JPEG, PNG and WebP pictures in the order they were chosen', () => {
    const files = [
      file('a.jpg', 'image/jpeg'),
      file('b.png', 'image/png'),
      file('c.webp', 'image/webp'),
    ];

    const result = selectPhotos(files, 8);

    expect(result.accepted).toEqual(files);
    expect(result.problems).toEqual([]);
  });

  it('turns away other kinds of file with a sentence about each', () => {
    const result = selectPhotos(
      [
        file('iphone.heic', 'image/heic'),
        file('doc.pdf', 'application/pdf'),
        file('ok.jpg', 'image/jpeg'),
      ],
      8,
    );

    expect(result.accepted.map((f) => f.name)).toEqual(['ok.jpg']);
    expect(result.problems).toEqual([
      'iphone.heic is not a JPEG, PNG or WebP picture.',
      'doc.pdf is not a JPEG, PNG or WebP picture.',
    ]);
  });

  it('turns away empty files and files over the size limit (exactly the limit is fine)', () => {
    const result = selectPhotos(
      [
        file('empty.jpg', 'image/jpeg', 0),
        file('huge.jpg', 'image/jpeg', MAX_IMAGE_BYTES + 1),
        file('edge.jpg', 'image/jpeg', MAX_IMAGE_BYTES),
      ],
      8,
    );

    expect(result.accepted.map((f) => f.name)).toEqual(['edge.jpg']);
    expect(result.problems).toEqual(['empty.jpg is empty.', 'huge.jpg is larger than 5 MB.']);
  });

  it('takes only as many as there is room for and says how many were left out', () => {
    const files = [1, 2, 3, 4].map((n) => file(`p${n}.jpg`, 'image/jpeg'));

    const result = selectPhotos(files, 2);

    expect(result.accepted.map((f) => f.name)).toEqual(['p1.jpg', 'p2.jpg']);
    expect(result.problems).toEqual(['Only 2 more photos fit, so 2 were left out.']);
  });

  it('uses the singular when one photo fits and one is left out', () => {
    const result = selectPhotos([file('a.jpg', 'image/jpeg'), file('b.jpg', 'image/jpeg')], 1);

    expect(result.problems).toEqual(['Only 1 more photo fits, so 1 was left out.']);
  });

  it('says the gallery is full when there is no room at all', () => {
    const result = selectPhotos([file('a.jpg', 'image/jpeg')], 0);

    expect(result.accepted).toEqual([]);
    expect(result.problems).toEqual(['The ad already has the most photos it can hold.']);
  });

  it('keeps a long or missing file name readable', () => {
    const result = selectPhotos(
      [file('x'.repeat(100) + '.gif', 'image/gif'), file('', 'image/gif')],
      8,
    );

    expect(result.problems[0]?.length).toBeLessThan(90);
    expect(result.problems[0]).toContain('…');
    expect(result.problems[1]).toBe('A file is not a JPEG, PNG or WebP picture.');
  });
});
