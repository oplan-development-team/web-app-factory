import bookshopEncounter from '../assets/photos/bookshop-encounter.jpg';
import coffeeCounterStory from '../assets/photos/coffee-counter-story.jpg';
import kitchenHours from '../assets/photos/kitchen-hours.jpg';
import learningToDecline from '../assets/photos/learning-to-decline.jpg';
import meetingNotesHandoff from '../assets/photos/meeting-notes-handoff.jpg';
import mendingOldFurniture from '../assets/photos/mending-old-furniture.jpg';
import morningTenMinutes from '../assets/photos/morning-ten-minutes.jpg';
import nightSupermarket from '../assets/photos/night-supermarket.jpg';
import notebookHabit from '../assets/photos/notebook-habit.jpg';
import rainyDayView from '../assets/photos/rainy-day-view.jpg';
import smallLivingIdeas from '../assets/photos/small-living-ideas.jpg';
import soloTripTime from '../assets/photos/solo-trip-time.jpg';
import tsundokuMountain from '../assets/photos/tsundoku-mountain.jpg';
import unforgettableScenery from '../assets/photos/unforgettable-scenery.jpg';
import walkingUnnamedRoads from '../assets/photos/walking-unnamed-roads.jpg';
import weekendBreakfast from '../assets/photos/weekend-breakfast.jpg';
import wordsThatDontFit from '../assets/photos/words-that-dont-fit.jpg';
import writingIsThinking from '../assets/photos/writing-is-thinking.jpg';

/**
 * One bundled still per article, keyed by article id. SPEC FR-02 forbids
 * runtime image fetching, so these ship as static build assets rather than
 * a live photo API — see apps/column-daily/README.md for sourcing/licence.
 */
const PHOTO_BY_ARTICLE_ID: Record<string, string> = {
  'bookshop-encounter': bookshopEncounter,
  'rainy-day-view': rainyDayView,
  'notebook-habit': notebookHabit,
  'weekend-breakfast': weekendBreakfast,
  'solo-trip-time': soloTripTime,
  'morning-ten-minutes': morningTenMinutes,
  'unforgettable-scenery': unforgettableScenery,
  'writing-is-thinking': writingIsThinking,
  'small-living-ideas': smallLivingIdeas,
  'kitchen-hours': kitchenHours,
  'tsundoku-mountain': tsundokuMountain,
  'coffee-counter-story': coffeeCounterStory,
  'meeting-notes-handoff': meetingNotesHandoff,
  'learning-to-decline': learningToDecline,
  'mending-old-furniture': mendingOldFurniture,
  'night-supermarket': nightSupermarket,
  'walking-unnamed-roads': walkingUnnamedRoads,
  'words-that-dont-fit': wordsThatDontFit,
};

export function photoForArticle(articleId: string): string {
  const photo = PHOTO_BY_ARTICLE_ID[articleId];
  if (!photo) {
    throw new Error(`No bundled photo for article "${articleId}"`);
  }
  return photo;
}
