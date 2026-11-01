import "server-only";
import artifact from "@/models/routine-shadow.json";
import { validateMLModel } from "./routine-ml-inference";
export const routineShadowModel=validateMLModel(artifact.model);
