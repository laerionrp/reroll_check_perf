function calculatePerformancePrice(vehiclePriceHT, cumulativeCoefficient, tvaRate) {
  const performancePriceHT = Math.ceil(
    Number(vehiclePriceHT) * Number(cumulativeCoefficient)
  );
  const tvaAmount = Math.ceil(performancePriceHT * Number(tvaRate));

  return performancePriceHT + tvaAmount;
}
