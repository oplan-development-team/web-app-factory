import { luminanceOfHex } from './utils/color';
import { randomSeed } from './utils/prng';
import { Action, AppState, INK_MAP, InkId } from './types';

export const MIN_INKS = 2;
export const MAX_INKS = 3;

function darkestInk(ids: InkId[]): InkId {
  return [...ids].sort((a, b) => luminanceOfHex(INK_MAP[a].hex) - luminanceOfHex(INK_MAP[b].hex))[0];
}

export function createInitialState(): AppState {
  const selectedInks: InkId[] = ['pink', 'blue'];
  return {
    photo: { bitmap: null, fileName: null },
    heading: '',
    subtext: '',
    shape: 'none',
    layout: 'center',
    selectedInks,
    textPlateInk: darkestInk(selectedInks),
    misregistrationStrength: 35,
    registrationSeed: randomSeed(),
    angleSpread: 100,
    paperTone: 30,
    paperGrain: 25,
    showRegistrationMarks: true,
    aspect: 'portrait',
    isExporting: false,
    exportScale: 2,
    inkLimitNotice: null,
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_PHOTO':
      return { ...state, photo: { bitmap: action.bitmap, fileName: action.fileName } };
    case 'CLEAR_PHOTO':
      return { ...state, photo: { bitmap: null, fileName: null } };
    case 'SET_HEADING':
      return { ...state, heading: action.value };
    case 'SET_SUBTEXT':
      return { ...state, subtext: action.value };
    case 'SET_SHAPE':
      return { ...state, shape: action.value };
    case 'SET_LAYOUT':
      return { ...state, layout: action.value };
    case 'TOGGLE_INK': {
      const has = state.selectedInks.includes(action.id);
      if (has) {
        if (state.selectedInks.length <= MIN_INKS) {
          return {
            ...state,
            inkLimitNotice: `最低${MIN_INKS}色は選択してください`,
          };
        }
        const nextInks = state.selectedInks.filter((id) => id !== action.id);
        const nextTextPlate =
          state.textPlateInk === action.id ? darkestInk(nextInks) : state.textPlateInk;
        return { ...state, selectedInks: nextInks, textPlateInk: nextTextPlate, inkLimitNotice: null };
      }
      if (state.selectedInks.length >= MAX_INKS) {
        return {
          ...state,
          inkLimitNotice: `最大${MAX_INKS}色まで選択できます`,
        };
      }
      const nextInks = [...state.selectedInks, action.id];
      return { ...state, selectedInks: nextInks, inkLimitNotice: null };
    }
    case 'SET_TEXT_PLATE_INK':
      return { ...state, textPlateInk: action.id };
    case 'SET_MISREGISTRATION':
      return { ...state, misregistrationStrength: action.value };
    case 'RESHUFFLE_SEED':
      return { ...state, registrationSeed: randomSeed() };
    case 'SET_ANGLE_SPREAD':
      return { ...state, angleSpread: action.value };
    case 'SET_PAPER_TONE':
      return { ...state, paperTone: action.value };
    case 'SET_PAPER_GRAIN':
      return { ...state, paperGrain: action.value };
    case 'TOGGLE_REGISTRATION_MARKS':
      return { ...state, showRegistrationMarks: !state.showRegistrationMarks };
    case 'SET_ASPECT':
      return { ...state, aspect: action.value };
    case 'SET_EXPORTING':
      return { ...state, isExporting: action.value };
    case 'SET_EXPORT_SCALE':
      return { ...state, exportScale: action.value };
    case 'CLEAR_INK_NOTICE':
      return { ...state, inkLimitNotice: null };
    default:
      return state;
  }
}

export function hasContent(state: AppState): boolean {
  return (
    state.photo.bitmap !== null ||
    state.heading.trim().length > 0 ||
    state.subtext.trim().length > 0 ||
    state.shape !== 'none'
  );
}

export type Store = {
  getState: () => AppState;
  dispatch: (action: Action) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createStore(initial: AppState): Store {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    dispatch(action: Action) {
      state = reducer(state, action);
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
