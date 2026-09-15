declare module "nigeria-state-lga-data" {
  type NigeriaLocationData = {
    getStates: () => string[];
    getLgas: (state: string) => string[];
  };

  const nigeriaLocationData: NigeriaLocationData;
  export default nigeriaLocationData;
}
