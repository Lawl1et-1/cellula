import { useEffect } from 'react';
import type { ShaderMaterial } from 'three';
import type { FocusKey } from '@/content/schema/scenario';
import { useSelection } from '@/state/selection';

/** Materials that glow when their organelle is hovered or selected. */
const registry = new Map<FocusKey, Set<ShaderMaterial>>();

export function registerHighlight(id: FocusKey, material: ShaderMaterial) {
  let set = registry.get(id);
  if (!set) registry.set(id, (set = new Set()));
  set.add(material);
  return () => void set!.delete(material);
}

export function materialsOf(id: FocusKey): Iterable<ShaderMaterial> {
  return registry.get(id) ?? [];
}

export function useHighlight(id: FocusKey | undefined, ...materials: ShaderMaterial[]) {
  useEffect(() => {
    if (!id) return;
    const off = materials.map((m) => registerHighlight(id, m));
    return () => off.forEach((f) => f());
  }, [id, ...materials]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Called once per frame: eases every registered material towards its hover / selection state. */
export function updateHighlights(delta: number) {
  const { hovered, selected, spotlight, focusKeys } = useSelection.getState();
  // Focus mode fades organelles in and out slowly between steps; hover stays snappy.
  const k = 1 - Math.exp(-delta * (focusKeys.length ? 2.5 : 10));
  for (const [id, materials] of registry) {
    const isHovered = hovered?.organelle === id;
    const isSelected = selected?.organelle === id;
    const inFocus = spotlight === id || focusKeys.includes(id);
    const target = isHovered ? 1 : isSelected ? 0.55 : inFocus ? 0.3 : 0;
    const instance = isHovered ? hovered.instance : isSelected ? selected.instance : undefined;
    for (const m of materials) {
      const u = m.uniforms;
      if (!u.uHighlight) continue;
      u.uHighlight.value += (target - u.uHighlight.value) * k;
      if (target > 0) u.uHighlightId!.value = instance ?? -1;
    }
  }
}
