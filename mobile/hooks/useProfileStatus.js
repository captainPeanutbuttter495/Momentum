import { useState, useEffect } from "react";
import { useAuth0 } from "react-native-auth0";
import { createApiClient } from "../services/api";
import { getProfile } from "../services/profile";

export default function useProfileStatus(user) {
  const { getCredentials } = useAuth0();
  const [profileStatus, setProfileStatus] = useState("loading");

  useEffect(() => {
    if (!user) {
      setProfileStatus("loading");
      return;
    }

    // Defensive: if getCredentials isn't available (e.g. in test mocks),
    // default to "complete" so the app doesn't block on onboarding
    if (typeof getCredentials !== "function") {
      setProfileStatus("complete");
      return;
    }

    let cancelled = false;

    async function checkProfile() {
      try {
        const credentials = await getCredentials();
        const api = createApiClient(credentials.accessToken);
        await getProfile(api);
        if (!cancelled) setProfileStatus("complete");
      } catch {
        if (!cancelled) setProfileStatus("needs_onboarding");
      }
    }

    checkProfile();

    return () => { cancelled = true; };
  }, [user, getCredentials]);

  return { profileStatus, setProfileStatus };
}
