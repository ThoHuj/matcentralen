export interface Ingredient {
  name: string;
  amount: number | null;
  unit: string | null;
  note: string;
  /** Föreslagen butiksavdelning; följer bara med från AI-importen. */
  category?: string;
}

export interface RecipeInput {
  name: string;
  servings: number;
  sourceUrl: string | null;
  instructions: string;
  notes: string;
  ingredients: Ingredient[];
}

export interface Recipe extends RecipeInput {
  id: number;
  plannedServings: number | null;
}

export interface RecipeSummary {
  id: number;
  name: string;
  servings: number;
  sourceUrl: string | null;
  ingredientCount: number;
  plannedServings: number | null;
}

export interface PlanRecipe {
  recipeId: number;
  name: string;
  servings: number;
  baseServings: number;
}

/** En delmängd av en vara. Mängderna är i basenhet (g, ml eller antal). */
export interface ListPart {
  dim: string;
  need: number;
  have: number;
  buy: number;
  needText: string;
  haveText: string;
  buyText: string;
  unit: string;
  units: string[];
}

export interface ListSource {
  type: 'recipe' | 'manual';
  id: number;
  label: string;
  text: string;
}

export interface ListItem {
  key: string;
  name: string;
  category: string;
  checked: boolean;
  /** Det som finns hemma räcker till hela behovet. */
  covered: boolean;
  done: boolean;
  /** Minst en källa anger varan utan mängd. */
  unspecified: boolean;
  parts: ListPart[];
  sources: ListSource[];
}

export interface ShoppingList {
  recipes: PlanRecipe[];
  items: ListItem[];
}

export interface Config {
  aiEnabled: boolean;
  model: string;
  suggestionsEnabled: boolean;
  categories: string[];
  units: string[];
}

export interface Suggestion {
  text: string;
  name: string;
  /** Var i appen förslaget skrevs, som hjälp för den som ska genomföra det. */
  page: string;
  theme: string;
  screen: string;
}

export interface HaveChange {
  dim: string;
  amount: number;
  unit?: string;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Ingen kontakt med servern.');
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Något gick fel (${response.status}).`);
  return data as T;
}

export const api = {
  config: () => request<Config>('GET', '/api/config'),

  recipes: () => request<RecipeSummary[]>('GET', '/api/recipes'),
  recipe: (id: number) => request<Recipe>('GET', `/api/recipes/${id}`),
  createRecipe: (recipe: RecipeInput) => request<Recipe>('POST', '/api/recipes', recipe),
  updateRecipe: (id: number, recipe: RecipeInput) => request<Recipe>('PUT', `/api/recipes/${id}`, recipe),
  setRecipeServings: (id: number, servings: number) =>
    request<Recipe>('PATCH', `/api/recipes/${id}/servings`, { servings }),
  deleteRecipe: (id: number) => request<void>('DELETE', `/api/recipes/${id}`),
  ingredientNames: () => request<string[]>('GET', '/api/ingredients'),
  importRecipe: (source: { url?: string; text?: string }) => request<RecipeInput>('POST', '/api/import', source),

  list: () => request<ShoppingList>('GET', '/api/list'),
  planRecipe: (recipeId: number, servings: number) =>
    request<ShoppingList>('PUT', `/api/list/recipes/${recipeId}`, { servings }),
  unplanRecipe: (recipeId: number) => request<ShoppingList>('DELETE', `/api/list/recipes/${recipeId}`),
  addItem: (text: string) => request<ShoppingList>('POST', '/api/list/items', { text }),
  removeItem: (id: number) => request<ShoppingList>('DELETE', `/api/list/items/${id}`),
  setItemState: (change: { key: string; checked?: boolean; have?: HaveChange[] }) =>
    request<ShoppingList>('POST', '/api/list/state', change),
  setCategory: (key: string, category: string) =>
    request<ShoppingList>('POST', '/api/list/category', { key, category }),
  clearList: () => request<ShoppingList>('POST', '/api/list/clear'),

  sendSuggestion: (suggestion: Suggestion) => request<void>('POST', '/api/suggestions', suggestion),
};
