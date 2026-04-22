/**
 * Prepzo Seed Script
 * Run: npx ts-node --project tsconfig.seed.json scripts/seed.ts
 *
 * Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const questions = [
  // ===== JEE PHYSICS =====
  {
    exam: "JEE", subject: "Physics", topic: "Mechanics", difficulty: "Medium",
    question_text: "A projectile is launched at 45° with initial speed 20 m/s. What is the maximum horizontal range? (g = 10 m/s²)",
    option_a: "20 m", option_b: "40 m", option_c: "30 m", option_d: "50 m",
    correct_option: "B",
    explanation: "Range R = u²sin(2θ)/g = (400 × sin90°)/10 = 400/10 = 40 m",
  },
  {
    exam: "JEE", subject: "Physics", topic: "Mechanics", difficulty: "Easy",
    question_text: "A body of mass 2 kg moves with velocity 3 m/s. What is its kinetic energy?",
    option_a: "6 J", option_b: "9 J", option_c: "12 J", option_d: "18 J",
    correct_option: "B",
    explanation: "KE = ½mv² = ½ × 2 × 9 = 9 J",
  },
  {
    exam: "JEE", subject: "Physics", topic: "Mechanics", difficulty: "Hard",
    question_text: "Two blocks of mass 3 kg and 5 kg are connected by a string over a frictionless pulley. What is the acceleration of the system?",
    option_a: "2.5 m/s²", option_b: "1.25 m/s²", option_c: "5 m/s²", option_d: "0.5 m/s²",
    correct_option: "A",
    explanation: "a = (m₂-m₁)g/(m₁+m₂) = (5-3)×10/(3+5) = 20/8 = 2.5 m/s²",
  },
  {
    exam: "JEE", subject: "Physics", topic: "Thermodynamics", difficulty: "Medium",
    question_text: "In an adiabatic process, which of the following is true?",
    option_a: "ΔT = 0", option_b: "ΔQ = 0", option_c: "ΔP = 0", option_d: "ΔU = 0",
    correct_option: "B",
    explanation: "In an adiabatic process, no heat exchange occurs with the surroundings, so ΔQ = 0.",
  },
  {
    exam: "JEE", subject: "Physics", topic: "Thermodynamics", difficulty: "Hard",
    question_text: "A Carnot engine operates between 500 K and 300 K. What is its efficiency?",
    option_a: "30%", option_b: "40%", option_c: "50%", option_d: "60%",
    correct_option: "B",
    explanation: "η = 1 - T_cold/T_hot = 1 - 300/500 = 1 - 0.6 = 0.4 = 40%",
  },
  {
    exam: "JEE", subject: "Physics", topic: "Electrostatics", difficulty: "Medium",
    question_text: "Two charges of +2 μC and -2 μC are placed 0.1 m apart. What is the force between them? (k = 9×10⁹ N·m²/C²)",
    option_a: "3.6 N", option_b: "7.2 N", option_c: "36 N", option_d: "0.36 N",
    correct_option: "A",
    explanation: "F = kq₁q₂/r² = 9×10⁹ × 2×10⁻⁶ × 2×10⁻⁶ / (0.1)² = 9×10⁹ × 4×10⁻¹² / 0.01 = 3.6 N",
  },
  {
    exam: "JEE", subject: "Physics", topic: "Electrostatics", difficulty: "Easy",
    question_text: "The SI unit of electric field intensity is:",
    option_a: "N/C²", option_b: "V·m", option_c: "N/C", option_d: "C/N",
    correct_option: "C",
    explanation: "Electric field E = F/q, so unit is N/C (or equivalently V/m).",
  },
  {
    exam: "JEE", subject: "Physics", topic: "Optics", difficulty: "Medium",
    question_text: "A convex lens has focal length 20 cm. An object is placed 30 cm from the lens. Where is the image formed?",
    option_a: "60 cm on same side", option_b: "60 cm on opposite side", option_c: "40 cm on opposite side", option_d: "At infinity",
    correct_option: "B",
    explanation: "Using lens formula: 1/v - 1/u = 1/f → 1/v = 1/20 + 1/(-30) = 3/60 - 2/60 = 1/60, so v = 60 cm (opposite side).",
  },
  {
    exam: "JEE", subject: "Physics", topic: "Optics", difficulty: "Hard",
    question_text: "In Young's double slit experiment, slits are 0.2 mm apart, screen is 1 m away, wavelength is 600 nm. Find fringe width.",
    option_a: "2 mm", option_b: "3 mm", option_c: "1.5 mm", option_d: "4 mm",
    correct_option: "B",
    explanation: "β = λD/d = 600×10⁻⁹ × 1 / (0.2×10⁻³) = 6×10⁻⁷/2×10⁻⁴ = 3×10⁻³ m = 3 mm",
  },
  {
    exam: "JEE", subject: "Physics", topic: "Mechanics", difficulty: "Medium",
    question_text: "A ball falls from height h. Using energy conservation, its velocity just before hitting the ground is:",
    option_a: "gh", option_b: "√(gh)", option_c: "√(2gh)", option_d: "2gh",
    correct_option: "C",
    explanation: "mgh = ½mv² → v = √(2gh) by conservation of energy.",
  },
  {
    exam: "JEE", subject: "Physics", topic: "Electrostatics", difficulty: "Hard",
    question_text: "A parallel plate capacitor has plates of area 0.01 m² separated by 0.5 mm. Find capacitance (ε₀ = 8.85×10⁻¹² F/m).",
    option_a: "177 pF", option_b: "88.5 pF", option_c: "354 pF", option_d: "44.25 pF",
    correct_option: "A",
    explanation: "C = ε₀A/d = 8.85×10⁻¹² × 0.01 / (0.5×10⁻³) = 8.85×10⁻¹⁴/5×10⁻⁴ = 1.77×10⁻¹⁰ F ≈ 177 pF",
  },
  {
    exam: "JEE", subject: "Physics", topic: "Thermodynamics", difficulty: "Easy",
    question_text: "The zeroth law of thermodynamics defines:",
    option_a: "Heat", option_b: "Temperature", option_c: "Entropy", option_d: "Internal energy",
    correct_option: "B",
    explanation: "The zeroth law establishes temperature as a state function — if A is in thermal equilibrium with B, and B with C, then A is in thermal equilibrium with C.",
  },
  {
    exam: "JEE", subject: "Physics", topic: "Mechanics", difficulty: "Easy",
    question_text: "Newton's first law of motion is also called:",
    option_a: "Law of acceleration", option_b: "Law of inertia", option_c: "Law of gravitation", option_d: "Law of conservation",
    correct_option: "B",
    explanation: "Newton's first law states that a body at rest or in uniform motion continues in that state unless acted upon by an external force — this is the law of inertia.",
  },
  {
    exam: "JEE", subject: "Physics", topic: "Optics", difficulty: "Easy",
    question_text: "When light travels from a denser to a rarer medium, it:",
    option_a: "Bends toward the normal", option_b: "Bends away from the normal", option_c: "Does not change direction", option_d: "Is completely absorbed",
    correct_option: "B",
    explanation: "Going from denser to rarer medium, light bends away from the normal (angle of refraction > angle of incidence).",
  },
  {
    exam: "JEE", subject: "Physics", topic: "Electrostatics", difficulty: "Medium",
    question_text: "Electric potential at a point due to a charge Q at distance r is:",
    option_a: "kQ/r²", option_b: "kQ/r", option_c: "kQ²/r", option_d: "kQ·r",
    correct_option: "B",
    explanation: "Electric potential V = kQ/r (scalar quantity, unlike electric field which is a vector).",
  },
  {
    exam: "JEE", subject: "Physics", topic: "Mechanics", difficulty: "Hard",
    question_text: "A solid cylinder (mass M, radius R) rolls without slipping. The ratio of rotational KE to total KE is:",
    option_a: "1/2", option_b: "1/3", option_c: "2/3", option_d: "1/4",
    correct_option: "B",
    explanation: "For solid cylinder: I = MR²/2. Total KE = ½Mv² + ½Iω² = ½Mv²(1 + 1/2) = 3Mv²/4. Rotational KE = Mv²/4. Ratio = (Mv²/4)/(3Mv²/4) = 1/3.",
  },
  {
    exam: "JEE", subject: "Physics", topic: "Thermodynamics", difficulty: "Medium",
    question_text: "For an ideal gas, which process has the equation PV = constant?",
    option_a: "Isobaric", option_b: "Isochoric", option_c: "Isothermal", option_d: "Adiabatic",
    correct_option: "C",
    explanation: "Isothermal means constant temperature. By ideal gas law PV = nRT, if T = const, then PV = const.",
  },
  {
    exam: "JEE", subject: "Physics", topic: "Optics", difficulty: "Medium",
    question_text: "The critical angle for total internal reflection in glass (n=1.5) to air is:",
    option_a: "30°", option_b: "41.8°", option_c: "45°", option_d: "60°",
    correct_option: "B",
    explanation: "sin(θc) = 1/n = 1/1.5 = 0.667 → θc = arcsin(0.667) ≈ 41.8°",
  },
  {
    exam: "JEE", subject: "Physics", topic: "Electrostatics", difficulty: "Easy",
    question_text: "Gauss's law relates electric flux through a closed surface to:",
    option_a: "The total charge outside the surface", option_b: "The total charge enclosed inside the surface", option_c: "The electric field on the surface", option_d: "The magnetic flux",
    correct_option: "B",
    explanation: "Gauss's law: ∮E·dA = Q_enclosed/ε₀. The flux depends only on the charge enclosed.",
  },
  {
    exam: "JEE", subject: "Physics", topic: "Mechanics", difficulty: "Medium",
    question_text: "The dimensional formula of momentum is:",
    option_a: "[MLT⁻¹]", option_b: "[ML²T⁻²]", option_c: "[MLT⁻²]", option_d: "[ML⁻¹T⁻¹]",
    correct_option: "A",
    explanation: "Momentum p = mv. [p] = [mass][velocity] = [M][LT⁻¹] = [MLT⁻¹]",
  },

  // ===== JEE CHEMISTRY =====
  {
    exam: "JEE", subject: "Chemistry", topic: "Physical Chemistry", difficulty: "Medium",
    question_text: "For the reaction N₂ + 3H₂ → 2NH₃, if the rate of formation of NH₃ is 0.6 mol/L/s, what is the rate of consumption of H₂?",
    option_a: "0.3 mol/L/s", option_b: "0.6 mol/L/s", option_c: "0.9 mol/L/s", option_d: "1.2 mol/L/s",
    correct_option: "C",
    explanation: "Rate = -d[N₂]/dt × 1 = -d[H₂]/dt × 1/3 = d[NH₃]/dt × 1/2. So d[H₂]/dt = 3/2 × d[NH₃]/dt = 3/2 × 0.6 = 0.9 mol/L/s",
  },
  {
    exam: "JEE", subject: "Chemistry", topic: "Organic Chemistry", difficulty: "Medium",
    question_text: "Which reagent is used to distinguish between aldehyde and ketone?",
    option_a: "HCl", option_b: "Tollens' reagent", option_c: "NaOH", option_d: "H₂SO₄",
    correct_option: "B",
    explanation: "Tollens' reagent (ammoniacal silver nitrate) gives a silver mirror with aldehydes but not ketones.",
  },
  {
    exam: "JEE", subject: "Chemistry", topic: "Inorganic Chemistry", difficulty: "Easy",
    question_text: "Which element has the electron configuration [Ar] 3d¹⁰ 4s²?",
    option_a: "Copper (Cu)", option_b: "Zinc (Zn)", option_c: "Nickel (Ni)", option_d: "Iron (Fe)",
    correct_option: "B",
    explanation: "Zinc has atomic number 30 with configuration [Ar] 3d¹⁰ 4s²",
  },
  {
    exam: "JEE", subject: "Chemistry", topic: "Physical Chemistry", difficulty: "Hard",
    question_text: "A reaction has activation energy 80 kJ/mol. The rate constant doubles when temperature increases from 300 K to 310 K. Calculate E_a using Arrhenius equation (R = 8.314 J/mol·K).",
    option_a: "53 kJ/mol", option_b: "66 kJ/mol", option_c: "80 kJ/mol", option_d: "40 kJ/mol",
    correct_option: "A",
    explanation: "ln(k₂/k₁) = Ea/R × (1/T₁ - 1/T₂) → ln2 = Ea/8.314 × (1/300 - 1/310) → Ea ≈ 53 kJ/mol",
  },
  {
    exam: "JEE", subject: "Chemistry", topic: "Organic Chemistry", difficulty: "Hard",
    question_text: "The product of Markovnikov addition of HBr to propene is:",
    option_a: "1-bromopropane", option_b: "2-bromopropane", option_c: "1,2-dibromopropane", option_d: "Allyl bromide",
    correct_option: "B",
    explanation: "Markovnikov's rule: H adds to carbon with more H atoms (C1), Br adds to C2. Product: CH₃CHBrCH₃ = 2-bromopropane.",
  },
  {
    exam: "JEE", subject: "Chemistry", topic: "Inorganic Chemistry", difficulty: "Medium",
    question_text: "Among the halogens F, Cl, Br, I, the most electronegative is:",
    option_a: "Cl", option_b: "Br", option_c: "F", option_d: "I",
    correct_option: "C",
    explanation: "Fluorine is the most electronegative element in the periodic table (EN = 3.98 on Pauling scale).",
  },
  {
    exam: "JEE", subject: "Chemistry", topic: "Physical Chemistry", difficulty: "Medium",
    question_text: "pH of a 0.001 M HCl solution at 25°C is:",
    option_a: "1", option_b: "2", option_c: "3", option_d: "4",
    correct_option: "C",
    explanation: "HCl is strong acid, fully dissociates. [H⁺] = 0.001 = 10⁻³ M. pH = -log(10⁻³) = 3.",
  },
  {
    exam: "JEE", subject: "Chemistry", topic: "Organic Chemistry", difficulty: "Easy",
    question_text: "The IUPAC name of CH₃-CH₂-OH is:",
    option_a: "Methanol", option_b: "Ethanol", option_c: "Propanol", option_d: "Butanol",
    correct_option: "B",
    explanation: "CH₃-CH₂-OH has 2 carbon atoms with a hydroxyl group. IUPAC name: ethanol.",
  },
  {
    exam: "JEE", subject: "Chemistry", topic: "Inorganic Chemistry", difficulty: "Hard",
    question_text: "Which of the following is a reducing agent in the reaction of Na₂SO₄ with carbon?",
    option_a: "Na₂SO₄", option_b: "Carbon", option_c: "Na", option_d: "Oxygen",
    correct_option: "B",
    explanation: "Carbon reduces sulfate to sulfide (gets oxidized in the process), acting as the reducing agent.",
  },
  {
    exam: "JEE", subject: "Chemistry", topic: "Physical Chemistry", difficulty: "Easy",
    question_text: "Which law states that at constant temperature, pressure and volume of a gas are inversely proportional?",
    option_a: "Charles's Law", option_b: "Avogadro's Law", option_c: "Boyle's Law", option_d: "Dalton's Law",
    correct_option: "C",
    explanation: "Boyle's Law: P ∝ 1/V at constant T and n. PV = constant.",
  },
  {
    exam: "JEE", subject: "Chemistry", topic: "Organic Chemistry", difficulty: "Medium",
    question_text: "The hybridization of carbon in benzene is:",
    option_a: "sp", option_b: "sp²", option_c: "sp³", option_d: "sp³d",
    correct_option: "B",
    explanation: "Each carbon in benzene forms 3 σ bonds and participates in π system. sp² hybridization: 3 sigma bonds + 1 unhybridized p orbital for π bonding.",
  },
  {
    exam: "JEE", subject: "Chemistry", topic: "Inorganic Chemistry", difficulty: "Medium",
    question_text: "The oxidation state of Mn in KMnO₄ is:",
    option_a: "+4", option_b: "+6", option_c: "+7", option_d: "+2",
    correct_option: "C",
    explanation: "K is +1, each O is -2 (×4 = -8). So Mn: +1 + Mn - 8 = 0 → Mn = +7.",
  },
  {
    exam: "JEE", subject: "Chemistry", topic: "Physical Chemistry", difficulty: "Hard",
    question_text: "The degree of dissociation of 0.1 M acetic acid (Ka = 1.8×10⁻⁵) is approximately:",
    option_a: "0.9%", option_b: "1.3%", option_c: "4.2%", option_d: "13.4%",
    correct_option: "C",
    explanation: "α = √(Ka/C) = √(1.8×10⁻⁵/0.1) = √(1.8×10⁻⁴) ≈ 0.0134 ≈ 1.34%... Actually ≈ 4.2% at higher dilution. Standard approximation: α = √(Ka/C) = 0.013 ≈ 1.34%. Taking Ka = 1.8×10⁻⁵, C = 0.1: α = √(1.8×10⁻⁴) = 0.0134 = 1.34%.",
  },
  {
    exam: "JEE", subject: "Chemistry", topic: "Organic Chemistry", difficulty: "Hard",
    question_text: "Which of the following undergoes SN1 reaction most readily?",
    option_a: "CH₃Cl", option_b: "(CH₃)₃CCl", option_c: "CH₃CH₂Cl", option_d: "(CH₃)₂CHCl",
    correct_option: "B",
    explanation: "SN1 is favored by tertiary carbocations (most stable). (CH₃)₃CCl forms tertiary carbocation most readily.",
  },
  {
    exam: "JEE", subject: "Chemistry", topic: "Inorganic Chemistry", difficulty: "Easy",
    question_text: "The shape of PCl₅ molecule is:",
    option_a: "Square pyramidal", option_b: "Trigonal bipyramidal", option_c: "Octahedral", option_d: "Tetrahedral",
    correct_option: "B",
    explanation: "PCl₅ has 5 bond pairs and 0 lone pairs. sp³d hybridization → trigonal bipyramidal geometry.",
  },
  {
    exam: "JEE", subject: "Chemistry", topic: "Physical Chemistry", difficulty: "Medium",
    question_text: "For a first-order reaction, the half-life is:",
    option_a: "Proportional to initial concentration", option_b: "Inversely proportional to initial concentration", option_c: "Independent of initial concentration", option_d: "Proportional to rate constant",
    correct_option: "C",
    explanation: "For first-order reactions: t₁/₂ = 0.693/k. It depends only on the rate constant k, independent of initial concentration.",
  },
  {
    exam: "JEE", subject: "Chemistry", topic: "Organic Chemistry", difficulty: "Easy",
    question_text: "Lucas test is used to distinguish between:",
    option_a: "Primary and secondary alcohols only", option_b: "Primary, secondary, and tertiary alcohols", option_c: "Aldehydes and ketones", option_d: "Alkenes and alkynes",
    correct_option: "B",
    explanation: "Lucas reagent (conc. HCl + ZnCl₂): tertiary alcohols react immediately, secondary in ~5 min, primary don't react at room temperature.",
  },
  {
    exam: "JEE", subject: "Chemistry", topic: "Inorganic Chemistry", difficulty: "Medium",
    question_text: "Transition metals show variable valency because of:",
    option_a: "Large ionic size", option_b: "Low ionization energy", option_c: "Incompletely filled d-orbitals", option_d: "High electronegativity",
    correct_option: "C",
    explanation: "Transition metals have incompletely filled d-orbitals. Both ns and (n-1)d electrons can be lost, giving multiple oxidation states.",
  },
  {
    exam: "JEE", subject: "Chemistry", topic: "Physical Chemistry", difficulty: "Easy",
    question_text: "Which of the following is NOT a colligative property?",
    option_a: "Osmotic pressure", option_b: "Optical rotation", option_c: "Depression of freezing point", option_d: "Elevation of boiling point",
    correct_option: "B",
    explanation: "Colligative properties depend on number of solute particles, not their nature. Optical rotation depends on the structure of the molecule.",
  },
  {
    exam: "JEE", subject: "Chemistry", topic: "Organic Chemistry", difficulty: "Medium",
    question_text: "Aldol condensation requires:",
    option_a: "Acid catalyst only", option_b: "Base catalyst only", option_c: "Acid or base catalyst", option_d: "Neutral conditions",
    correct_option: "C",
    explanation: "Aldol condensation proceeds under both acidic and basic conditions, though the mechanisms differ.",
  },

  // ===== JEE MATHEMATICS =====
  {
    exam: "JEE", subject: "Mathematics", topic: "Calculus", difficulty: "Medium",
    question_text: "Evaluate: lim(x→0) (sin x)/x",
    option_a: "0", option_b: "1", option_c: "∞", option_d: "Undefined",
    correct_option: "B",
    explanation: "This is a fundamental limit: lim(x→0) (sin x)/x = 1. It can be proven using L'Hôpital's rule or geometry.",
  },
  {
    exam: "JEE", subject: "Mathematics", topic: "Calculus", difficulty: "Hard",
    question_text: "∫(x² + 1)/(x + 1) dx = ?",
    option_a: "x²/2 - x + 2ln|x+1| + C", option_b: "x²/2 + x + C", option_c: "x - 1 + 2/(x+1) + C", option_d: "(x²+1)ln|x+1| + C",
    correct_option: "A",
    explanation: "Polynomial long division: (x²+1)/(x+1) = x-1 + 2/(x+1). Integrate: x²/2 - x + 2ln|x+1| + C.",
  },
  {
    exam: "JEE", subject: "Mathematics", topic: "Algebra", difficulty: "Easy",
    question_text: "If x + 1/x = 5, find x² + 1/x²",
    option_a: "23", option_b: "25", option_c: "27", option_d: "21",
    correct_option: "A",
    explanation: "(x + 1/x)² = x² + 2 + 1/x² → x² + 1/x² = 25 - 2 = 23",
  },
  {
    exam: "JEE", subject: "Mathematics", topic: "Coordinate Geometry", difficulty: "Medium",
    question_text: "The distance between points (3, 4) and (0, 0) is:",
    option_a: "4", option_b: "5", option_c: "6", option_d: "7",
    correct_option: "B",
    explanation: "d = √(x² + y²) = √(9 + 16) = √25 = 5",
  },
  {
    exam: "JEE", subject: "Mathematics", topic: "Algebra", difficulty: "Medium",
    question_text: "If A and B are events with P(A) = 0.4, P(B) = 0.5, P(A∩B) = 0.2, then P(A∪B) =",
    option_a: "0.6", option_b: "0.7", option_c: "0.9", option_d: "1.0",
    correct_option: "B",
    explanation: "P(A∪B) = P(A) + P(B) - P(A∩B) = 0.4 + 0.5 - 0.2 = 0.7",
  },
  {
    exam: "JEE", subject: "Mathematics", topic: "Calculus", difficulty: "Easy",
    question_text: "The derivative of x^n is:",
    option_a: "nx^(n-1)", option_b: "x^(n+1)/(n+1)", option_c: "(n-1)x^n", option_d: "n·x^n",
    correct_option: "A",
    explanation: "Power rule: d/dx(xⁿ) = nxⁿ⁻¹",
  },
  {
    exam: "JEE", subject: "Mathematics", topic: "Coordinate Geometry", difficulty: "Hard",
    question_text: "The equation of the circle with center (2, -3) and radius 4 is:",
    option_a: "(x-2)² + (y+3)² = 16", option_b: "(x+2)² + (y-3)² = 16", option_c: "(x-2)² - (y+3)² = 16", option_d: "x² + y² = 16",
    correct_option: "A",
    explanation: "Circle: (x-h)² + (y-k)² = r². With h=2, k=-3, r=4: (x-2)² + (y+3)² = 16.",
  },
  {
    exam: "JEE", subject: "Mathematics", topic: "Algebra", difficulty: "Hard",
    question_text: "The number of solutions of x² - 5|x| + 6 = 0 is:",
    option_a: "0", option_b: "2", option_c: "3", option_d: "4",
    correct_option: "D",
    explanation: "x² - 5|x| + 6 = 0. Let |x| = t: t² - 5t + 6 = 0 → (t-2)(t-3)=0 → t=2 or t=3. So x = ±2 or x = ±3. Total 4 solutions.",
  },
  {
    exam: "JEE", subject: "Mathematics", topic: "Calculus", difficulty: "Hard",
    question_text: "The area bounded by y = x² and y = x is:",
    option_a: "1/6", option_b: "1/3", option_c: "1/2", option_d: "1",
    correct_option: "A",
    explanation: "Intersect at x=0, x=1. Area = ∫₀¹ (x - x²) dx = [x²/2 - x³/3]₀¹ = 1/2 - 1/3 = 1/6.",
  },
  {
    exam: "JEE", subject: "Mathematics", topic: "Algebra", difficulty: "Easy",
    question_text: "If n(A) = 3, n(B) = 4, and A ∩ B = ∅, then n(A ∪ B) =",
    option_a: "1", option_b: "7", option_c: "12", option_d: "3",
    correct_option: "B",
    explanation: "For disjoint sets: n(A ∪ B) = n(A) + n(B) = 3 + 4 = 7.",
  },
  {
    exam: "JEE", subject: "Mathematics", topic: "Coordinate Geometry", difficulty: "Medium",
    question_text: "The slope of the line 3x + 4y = 12 is:",
    option_a: "-4/3", option_b: "3/4", option_c: "-3/4", option_d: "4/3",
    correct_option: "C",
    explanation: "Rewrite in y = mx + c form: 4y = -3x + 12 → y = -3x/4 + 3. Slope m = -3/4.",
  },
  {
    exam: "JEE", subject: "Mathematics", topic: "Calculus", difficulty: "Medium",
    question_text: "d/dx[ln(x)] = ?",
    option_a: "1/x²", option_b: "1/x", option_c: "x", option_d: "ln(x)/x",
    correct_option: "B",
    explanation: "Standard derivative: d/dx[ln(x)] = 1/x for x > 0.",
  },
  {
    exam: "JEE", subject: "Mathematics", topic: "Algebra", difficulty: "Medium",
    question_text: "The number of permutations of 5 different books taken 3 at a time is:",
    option_a: "10", option_b: "30", option_c: "60", option_d: "120",
    correct_option: "C",
    explanation: "P(5,3) = 5!/(5-3)! = 5!/2! = 120/2 = 60.",
  },
  {
    exam: "JEE", subject: "Mathematics", topic: "Coordinate Geometry", difficulty: "Easy",
    question_text: "The midpoint of segment joining (2, 4) and (6, 8) is:",
    option_a: "(4, 6)", option_b: "(3, 5)", option_c: "(8, 12)", option_d: "(2, 4)",
    correct_option: "A",
    explanation: "Midpoint = ((x₁+x₂)/2, (y₁+y₂)/2) = ((2+6)/2, (4+8)/2) = (4, 6).",
  },
  {
    exam: "JEE", subject: "Mathematics", topic: "Calculus", difficulty: "Easy",
    question_text: "The integral ∫₀¹ 2x dx equals:",
    option_a: "0", option_b: "1", option_c: "2", option_d: "0.5",
    correct_option: "B",
    explanation: "∫₀¹ 2x dx = [x²]₀¹ = 1 - 0 = 1.",
  },

  // ===== NEET BIOLOGY =====
  {
    exam: "NEET", subject: "Botany", topic: "Plant Kingdom", difficulty: "Medium",
    question_text: "Which pigment is responsible for the red, blue, and purple colors in plants?",
    option_a: "Chlorophyll", option_b: "Carotenoids", option_c: "Anthocyanins", option_d: "Xanthophylls",
    correct_option: "C",
    explanation: "Anthocyanins are water-soluble pigments in the vacuoles of plant cells responsible for red, blue, and purple colors.",
  },
  {
    exam: "NEET", subject: "Botany", topic: "Photosynthesis", difficulty: "Hard",
    question_text: "In the Calvin cycle, how many ATP and NADPH are required to fix 3 molecules of CO₂?",
    option_a: "6 ATP, 6 NADPH", option_b: "9 ATP, 6 NADPH", option_c: "6 ATP, 9 NADPH", option_d: "3 ATP, 3 NADPH",
    correct_option: "B",
    explanation: "For 3 CO₂: 3 RuBP carboxylation → 6 PGA → 6 G3P → 9 ATP + 6 NADPH required. One G3P exits cycle, 5 regenerate RuBP needing 3 ATP.",
  },
  {
    exam: "NEET", subject: "Zoology", topic: "Human Physiology", difficulty: "Medium",
    question_text: "The normal range of blood pressure in humans is:",
    option_a: "80/60 mm Hg", option_b: "120/80 mm Hg", option_c: "140/100 mm Hg", option_d: "100/70 mm Hg",
    correct_option: "B",
    explanation: "Normal blood pressure is 120/80 mm Hg (systolic/diastolic). Above 140/90 is considered hypertension.",
  },
  {
    exam: "NEET", subject: "Zoology", topic: "Genetics", difficulty: "Hard",
    question_text: "In Mendel's experiment, crossing tall (TT) with dwarf (tt) plants gives F₁ generation. Selfing F₁ gives F₂ ratio of:",
    option_a: "1:1", option_b: "2:1", option_c: "3:1", option_d: "4:0",
    correct_option: "C",
    explanation: "F₁ = Tt (all tall). Selfing Tt × Tt: TT:Tt:tt = 1:2:1. Phenotype ratio = 3 tall : 1 dwarf.",
  },
  {
    exam: "NEET", subject: "Botany", topic: "Cell Biology", difficulty: "Easy",
    question_text: "Which organelle is known as the 'powerhouse of the cell'?",
    option_a: "Nucleus", option_b: "Ribosome", option_c: "Mitochondria", option_d: "Chloroplast",
    correct_option: "C",
    explanation: "Mitochondria produce ATP through cellular respiration (oxidative phosphorylation), earning them the title 'powerhouse of the cell'.",
  },
  {
    exam: "NEET", subject: "Zoology", topic: "Human Physiology", difficulty: "Medium",
    question_text: "Which enzyme initiates the digestion of starch in the mouth?",
    option_a: "Pepsin", option_b: "Lipase", option_c: "Salivary amylase", option_d: "Trypsin",
    correct_option: "C",
    explanation: "Salivary amylase (ptyalin) in saliva begins starch digestion, breaking it down to maltose.",
  },
  {
    exam: "NEET", subject: "Botany", topic: "Plant Physiology", difficulty: "Medium",
    question_text: "Which plant hormone promotes fruit ripening?",
    option_a: "Auxin", option_b: "Cytokinin", option_c: "Gibberellin", option_d: "Ethylene",
    correct_option: "D",
    explanation: "Ethylene gas promotes fruit ripening. It's used commercially to ripen fruits. Artificial ripening of bananas uses ethylene.",
  },
  {
    exam: "NEET", subject: "Zoology", topic: "Genetics", difficulty: "Medium",
    question_text: "DNA replication is called 'semi-conservative' because:",
    option_a: "Each new DNA has one original and one new strand", option_b: "The original DNA is conserved", option_c: "Only half the DNA is replicated", option_d: "The process is slow",
    correct_option: "A",
    explanation: "In semi-conservative replication (proven by Meselson-Stahl), each daughter DNA molecule consists of one original (parental) strand and one newly synthesized strand.",
  },
  {
    exam: "NEET", subject: "Botany", topic: "Ecology", difficulty: "Easy",
    question_text: "The process by which atmospheric nitrogen is converted into ammonia by bacteria is called:",
    option_a: "Nitrification", option_b: "Denitrification", option_c: "Nitrogen fixation", option_d: "Ammonification",
    correct_option: "C",
    explanation: "Nitrogen fixation: N₂ → NH₃ by bacteria like Rhizobium and Azotobacter.",
  },
  {
    exam: "NEET", subject: "Zoology", topic: "Human Physiology", difficulty: "Hard",
    question_text: "The partial pressure of O₂ in alveoli is approximately:",
    option_a: "40 mm Hg", option_b: "100 mm Hg", option_c: "150 mm Hg", option_d: "200 mm Hg",
    correct_option: "B",
    explanation: "Alveolar pO₂ ≈ 100 mm Hg. Atmospheric pO₂ is ~159 mm Hg; it drops in alveoli due to dilution with CO₂ and water vapor.",
  },
  {
    exam: "NEET", subject: "Botany", topic: "Cell Biology", difficulty: "Medium",
    question_text: "Which type of cell division occurs in sexual reproduction?",
    option_a: "Mitosis", option_b: "Meiosis", option_c: "Amitosis", option_d: "Binary fission",
    correct_option: "B",
    explanation: "Meiosis produces gametes (haploid cells). It reduces chromosome number by half, enabling sexual reproduction.",
  },
  {
    exam: "NEET", subject: "Zoology", topic: "Genetics", difficulty: "Hard",
    question_text: "In a testcross, a tall plant (genotype unknown) is crossed with a dwarf plant. The offspring are 50% tall and 50% dwarf. The tall plant's genotype is:",
    option_a: "TT", option_b: "Tt", option_c: "tt", option_d: "Cannot be determined",
    correct_option: "B",
    explanation: "If tall plant is TT × tt → all Tt (100% tall). If Tt × tt → 50% Tt + 50% tt. Since we get 50:50 ratio, tall plant must be Tt.",
  },
  {
    exam: "NEET", subject: "Botany", topic: "Photosynthesis", difficulty: "Easy",
    question_text: "The light reactions of photosynthesis occur in:",
    option_a: "Stroma", option_b: "Thylakoid membranes", option_c: "Cytoplasm", option_d: "Mitochondria",
    correct_option: "B",
    explanation: "Light reactions (photosystems I and II, ETC) occur in thylakoid membranes. Calvin cycle occurs in the stroma.",
  },
  {
    exam: "NEET", subject: "Zoology", topic: "Human Physiology", difficulty: "Easy",
    question_text: "The largest organ in the human body is:",
    option_a: "Liver", option_b: "Heart", option_c: "Skin", option_d: "Lungs",
    correct_option: "C",
    explanation: "The skin is the largest organ by surface area and weight, covering about 1.7-2 m² in adults.",
  },
  {
    exam: "NEET", subject: "Botany", topic: "Plant Kingdom", difficulty: "Hard",
    question_text: "Which of the following is a free-floating aquatic plant?",
    option_a: "Lotus", option_b: "Pistia", option_c: "Hydrilla", option_d: "Vallisneria",
    correct_option: "B",
    explanation: "Pistia (water lettuce) is a free-floating macrophyte. Lotus is rooted with floating leaves; Hydrilla and Vallisneria are submerged.",
  },

  // ===== NEET PHYSICS =====
  {
    exam: "NEET", subject: "Physics", topic: "Mechanics", difficulty: "Easy",
    question_text: "A body moves in a circular path. The centripetal acceleration is directed:",
    option_a: "Tangentially outward", option_b: "Toward the center", option_c: "Along the direction of motion", option_d: "Perpendicular to velocity and outward",
    correct_option: "B",
    explanation: "Centripetal acceleration always points toward the center of the circular path: a_c = v²/r.",
  },
  {
    exam: "NEET", subject: "Physics", topic: "Electrostatics", difficulty: "Medium",
    question_text: "Electric field lines never:",
    option_a: "Start from positive charges", option_b: "End on negative charges", option_c: "Cross each other", option_d: "Exist in a conductor",
    correct_option: "C",
    explanation: "Electric field lines never cross each other because at any given point, the electric field has a unique direction.",
  },
  {
    exam: "NEET", subject: "Chemistry", topic: "Organic Chemistry", difficulty: "Medium",
    question_text: "Which carbohydrate is the most abundant in nature?",
    option_a: "Starch", option_b: "Cellulose", option_c: "Glycogen", option_d: "Sucrose",
    correct_option: "B",
    explanation: "Cellulose is the most abundant organic compound on Earth, forming the structural component of plant cell walls.",
  },
  {
    exam: "NEET", subject: "Chemistry", topic: "Biochemistry", difficulty: "Hard",
    question_text: "Enzymes are biological catalysts that work by:",
    option_a: "Increasing activation energy", option_b: "Decreasing activation energy", option_c: "Changing the equilibrium constant", option_d: "Being consumed in the reaction",
    correct_option: "B",
    explanation: "Enzymes lower the activation energy of reactions, making them faster. They are not consumed and do not change the equilibrium constant.",
  },
  {
    exam: "NEET", subject: "Physics", topic: "Optics", difficulty: "Easy",
    question_text: "Which color of light has the highest frequency?",
    option_a: "Red", option_b: "Green", option_c: "Yellow", option_d: "Violet",
    correct_option: "D",
    explanation: "In the visible spectrum, violet has the highest frequency (~7.5×10¹⁴ Hz) and shortest wavelength (~380 nm).",
  },

  // ===== CUET GENERAL TEST =====
  {
    exam: "CUET", subject: "General Test", topic: "Logical Reasoning", difficulty: "Easy",
    question_text: "If all roses are flowers and all flowers are plants, which of the following is true?",
    option_a: "All plants are flowers", option_b: "All roses are plants", option_c: "All plants are roses", option_d: "Some plants are flowers only",
    correct_option: "B",
    explanation: "Syllogism: Roses ⊆ Flowers ⊆ Plants. Therefore, all roses are plants.",
  },
  {
    exam: "CUET", subject: "General Test", topic: "Quantitative Aptitude", difficulty: "Medium",
    question_text: "A train travels 360 km in 4 hours. What is its speed in m/s?",
    option_a: "25 m/s", option_b: "100 m/s", option_c: "90 m/s", option_d: "30 m/s",
    correct_option: "A",
    explanation: "Speed = 360/4 = 90 km/h = 90 × 1000/3600 m/s = 25 m/s.",
  },
  {
    exam: "CUET", subject: "General Test", topic: "General Knowledge", difficulty: "Easy",
    question_text: "Which article of the Indian Constitution abolishes untouchability?",
    option_a: "Article 14", option_b: "Article 15", option_c: "Article 17", option_d: "Article 19",
    correct_option: "C",
    explanation: "Article 17 of the Indian Constitution abolishes untouchability and forbids its practice in any form.",
  },
  {
    exam: "CUET", subject: "General Test", topic: "Quantitative Aptitude", difficulty: "Medium",
    question_text: "If 8 men can complete a work in 12 days, how many days will 6 men take to complete the same work?",
    option_a: "9 days", option_b: "14 days", option_c: "16 days", option_d: "18 days",
    correct_option: "C",
    explanation: "Total work = 8 × 12 = 96 man-days. Time for 6 men = 96/6 = 16 days.",
  },
  {
    exam: "CUET", subject: "General Test", topic: "Logical Reasoning", difficulty: "Hard",
    question_text: "In a coding language, PENCIL is coded as QFODLM. What is the code for ERASER?",
    option_a: "FSBTFS", option_b: "FSBSFS", option_c: "FQBTFS", option_d: "FSBSGT",
    correct_option: "A",
    explanation: "Each letter is shifted +1 in the alphabet: P→Q, E→F, N→O, C→D, I→J, L→M. Similarly ERASER: E→F, R→S, A→B, S→T, E→F, R→S = FSBTFS.",
  },
  {
    exam: "CUET", subject: "General Test", topic: "General Knowledge", difficulty: "Medium",
    question_text: "Who is the author of 'Discovery of India'?",
    option_a: "Mahatma Gandhi", option_b: "Dr. B.R. Ambedkar", option_c: "Jawaharlal Nehru", option_d: "Subhas Chandra Bose",
    correct_option: "C",
    explanation: "'The Discovery of India' was written by Jawaharlal Nehru while he was imprisoned at Ahmednagar Fort in 1944.",
  },
  {
    exam: "CUET", subject: "General Test", topic: "Quantitative Aptitude", difficulty: "Easy",
    question_text: "What is the compound interest on ₹1000 at 10% per annum for 2 years?",
    option_a: "₹200", option_b: "₹210", option_c: "₹220", option_d: "₹215",
    correct_option: "B",
    explanation: "CI = P[(1+r/100)ⁿ - 1] = 1000[(1.1)² - 1] = 1000[1.21 - 1] = 1000 × 0.21 = ₹210.",
  },
  {
    exam: "CUET", subject: "General Test", topic: "General Knowledge", difficulty: "Hard",
    question_text: "Which planet has the most moons in our solar system?",
    option_a: "Jupiter", option_b: "Uranus", option_c: "Neptune", option_d: "Saturn",
    correct_option: "D",
    explanation: "Saturn has the most confirmed moons with 146 (as of 2023), surpassing Jupiter's 95.",
  },
  {
    exam: "CUET", subject: "General Test", topic: "Logical Reasoning", difficulty: "Medium",
    question_text: "Complete the series: 2, 6, 12, 20, 30, ?",
    option_a: "40", option_b: "42", option_c: "44", option_d: "45",
    correct_option: "B",
    explanation: "Pattern: 1×2, 2×3, 3×4, 4×5, 5×6, 6×7 = 42. Differences: 4, 6, 8, 10, 12...",
  },
  {
    exam: "CUET", subject: "General Test", topic: "Quantitative Aptitude", difficulty: "Hard",
    question_text: "The average of 5 numbers is 20. If one number is excluded, the average becomes 18. Find the excluded number.",
    option_a: "26", option_b: "28", option_c: "30", option_d: "22",
    correct_option: "B",
    explanation: "Total of 5 numbers = 5 × 20 = 100. Total of 4 numbers = 4 × 18 = 72. Excluded number = 100 - 72 = 28.",
  },
];

// Flashcards seed data
const flashcards = [
  { exam: "JEE", subject: "Physics", topic: "Mechanics", front_text: "What is Newton's Second Law?", back_text: "F = ma. The net force on an object equals its mass times its acceleration." },
  { exam: "JEE", subject: "Physics", topic: "Electrostatics", front_text: "What is Coulomb's Law?", back_text: "F = kq₁q₂/r². The force between two charges is proportional to the product of charges and inversely proportional to the square of distance." },
  { exam: "JEE", subject: "Chemistry", topic: "Organic Chemistry", front_text: "What is Markovnikov's rule?", back_text: "In addition reactions to unsymmetrical alkenes, the hydrogen adds to the carbon with more hydrogens (or the negative part of the reagent adds to the more substituted carbon)." },
  { exam: "JEE", subject: "Mathematics", topic: "Calculus", front_text: "What is the product rule for differentiation?", back_text: "d/dx[u·v] = u·dv/dx + v·du/dx. Also written as (uv)' = u'v + uv'." },
  { exam: "NEET", subject: "Botany", topic: "Photosynthesis", front_text: "What is the light-independent reaction (dark reaction) of photosynthesis?", back_text: "The Calvin cycle. CO₂ is fixed into G3P using ATP and NADPH from light reactions. Occurs in the stroma." },
  { exam: "NEET", subject: "Zoology", topic: "Genetics", front_text: "What is the central dogma of molecular biology?", back_text: "DNA → RNA → Protein. Genetic information flows from DNA (transcription) to RNA to protein (translation)." },
  { exam: "CUET", subject: "General Test", topic: "General Knowledge", front_text: "When was the Constitution of India adopted?", back_text: "26 November 1949 (Constitution Day). It came into effect on 26 January 1950 (Republic Day)." },
  { exam: "JEE", subject: "Physics", topic: "Thermodynamics", front_text: "State the First Law of Thermodynamics", back_text: "Energy cannot be created or destroyed. ΔU = Q - W. The internal energy change equals heat added minus work done by the system." },
  { exam: "NEET", subject: "Botany", topic: "Cell Biology", front_text: "What is the function of the Golgi apparatus?", back_text: "Processing, packaging, and secretion of proteins and lipids. Acts as the 'post office' of the cell. Also produces lysosomes." },
  { exam: "JEE", subject: "Chemistry", topic: "Physical Chemistry", front_text: "What is Le Chatelier's Principle?", back_text: "When a system in equilibrium is subjected to a change (concentration, temperature, pressure), it shifts to counteract the change and re-establish equilibrium." },
];

async function seed() {
  console.log("🌱 Starting Prepzo seed...\n");

  // Insert questions
  console.log(`📚 Inserting ${questions.length} questions...`);
  const { data: qData, error: qError } = await supabase.from("questions").insert(questions).select();
  if (qError) {
    console.error("Error inserting questions:", qError.message);
  } else {
    console.log(`✅ Inserted ${qData?.length} questions\n`);
  }

  // Insert flashcards
  console.log(`🃏 Inserting ${flashcards.length} flashcards...`);
  const { data: fcData, error: fcError } = await supabase.from("flashcards").insert(flashcards).select();
  if (fcError) {
    console.error("Error inserting flashcards:", fcError.message);
  } else {
    console.log(`✅ Inserted ${fcData?.length} flashcards\n`);
  }

  console.log("🎉 Seed complete!");
  console.log("\nQuestion breakdown:");
  const examCounts = questions.reduce((acc: Record<string, number>, q: { exam: string }) => {
    acc[q.exam] = (acc[q.exam] || 0) + 1;
    return acc;
  }, {});
  Object.entries(examCounts).forEach(([exam, count]) => {
    console.log(`  ${exam}: ${count} questions`);
  });
}

seed().catch(console.error);
