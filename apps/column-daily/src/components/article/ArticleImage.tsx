import type { Article } from '../../data/types';
import { photoForArticle } from '../../data/photos';
import './article-image.css';

/**
 * Article artwork. SPEC FR-02 forbids runtime image fetching, so every
 * article ships with one bundled still (see src/data/photos.ts) rather than
 * a live photo API — the same still is reused wherever that article appears
 * (feature, card, row, ranking thumb), cropped by its container.
 */

interface ArticleImageProps {
  readonly article: Article;
  /** Extra class for sizing/framing by the caller. */
  readonly className?: string;
}

export function ArticleImage({ article, className }: ArticleImageProps) {
  return (
    <img
      className={className ? `article-image ${className}` : 'article-image'}
      src={photoForArticle(article.id)}
      alt={`${article.category}のコラム「${article.title}」の挿絵`}
    />
  );
}
