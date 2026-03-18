import { createContext, useContext } from "react";

const OnboardingContext = createContext({ onComplete: () => {} });

export const useOnboarding = () => useContext(OnboardingContext);

export default OnboardingContext;
