import { ArticleCard } from '../components/article/ArticleCard';
import { FeatureArticle } from '../components/article/FeatureArticle';
import { Sidebar } from '../components/sidebar/Sidebar';
import { SectionHeading } from '../components/ui/SectionHeading';
import { editorsPick, newestFirst, seriesGroups } from '../lib/selectors';
import { Link } from 'react-router-dom';
import '../components/article/article.css';
import './home.css';

export function HomePage() {
  const feature = editorsPick();
  const latest = newestFirst()
    .filter((article) => article.id !== feature.id)
    .slice(0, 4);
  const series = seriesGroups().slice(0, 3);

  return (
    <div className="home">
      <div className="home__main min-w-0">
        <FeatureArticle article={feature} />

        <section className="home__section" aria-labelledby="latest-heading">
          <SectionHeading
            title="新着コラム"
            eyebrow="Latest"
            moreLabel="もっと見る"
            moreTo="/latest"
          />
          <div className="column-grid" id="latest-heading">
            {latest.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </section>

        <section className="home__section" aria-labelledby="series-heading">
          <SectionHeading
            title="連載中のコラム"
            eyebrow="Series"
            moreLabel="連載一覧へ"
            moreTo="/series"
          />
          <ul className="series-strip" id="series-heading">
            {series.map((group, index) => {
              const lead = group.articles[0];
              return (
                <li className="series-strip__item min-w-0" key={group.name}>
                  <p className="label-caps series-strip__label">
                    {`Series ${String(index + 1).padStart(2, '0')}`}
                  </p>
                  <h3 className="series-strip__name">{group.name}</h3>
                  <p className="series-strip__lead">
                    第1回：
                    <Link className="ink-link" to={`/articles/${lead.id}`}>
                      {lead.title}
                    </Link>
                  </p>
                  <p className="meta series-strip__count">全{group.articles.length}回・更新中</p>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <Sidebar />
    </div>
  );
}
