// Сахна құралдарына ортақ типтер мен контекст.

import { createContext, useContext } from "react";

export type Vec3 = [number, number, number];

/** Сахна ішіндегі құрал күйі (Canvas ішінде қолжетімді). */
export interface LabToolState {
  rulerActive: boolean;
}

export const LabToolContext = createContext<LabToolState>({ rulerActive: false });
export const useLabTool = () => useContext(LabToolContext);

/* Динамометр өлшемдері (м): шкала тақтасы, нөлдік белгі және ілгекке дейінгі өзек. */
export const DYN = { PLATE_TOP: -0.01, PLATE_H: 0.2, ZERO: -0.03, ROD: 0.17 } as const;

/** Ілгек нүктесінің динамометрдің жоғарғы нүктесіне қатысты y-ығысуы. */
export const dynamometerHookY = (extension: number) => DYN.ZERO - extension - DYN.ROD;
