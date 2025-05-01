const channels = [
  { id: "2903902", key: "9SHP8CJB8MN7R23M" },  // Channel 1 – Light Gases
  { id: "2916597", key: "RC5X2P94Q8HZ7OLB" },  // Channel 2 – Heavy Gases
  { id: "2918153", key: "4SAG55SC360K1088" }   // Channel 3 – CO + Env
];

const fieldMapping = {
  2903902: ["hydrogen", "ammonia", "co2", "methane"],
  2916597: ["nox", "benzene", "so2", "lpg", "butane"],
  2918153: ["temperature", "humidity", "naturalgas", "co"]
};

const thresholds = {
  methane: [200, 1000],
  ammonia: [25, 500],
  co2: [600, 1000],
  hydrogen: [1000, 4000],
  benzene: [0.5, 1],
  so2: [2, 5],
  nox: [1, 5],
  lpg: [1000, 2000],
  butane: [1000, 2000],
  naturalgas: [1000, 5000],
  co: [35, 100]
};

function getStatus(value, key) {
  const [low, high] = thresholds[key] || [0, 100];
  if (value <= low) return "good";
  if (value <= high) return "moderate";
  return "bad";
}

function updateSVGGauge(sensor, value) {
  const maxValue = 300;
  const percentage = Math.min(value / maxValue, 1);
  const angle = percentage * 180;

  const pointer = document.getElementById(`pointer-${sensor}`);
  const arc = document.getElementById(`arc-${sensor}`);
  const reading = document.getElementById(`value-${sensor}`);

  if (!pointer || !arc || !reading) return;

  // Rotate pointer (-90° origin)
  pointer.setAttribute("transform", `rotate(${angle - 90} 100 100)`);

  // Arc fill based on value
  const arcLength = 283;
  arc.setAttribute("stroke-dasharray", `${arcLength} ${arcLength}`);
  arc.setAttribute("stroke-dashoffset", arcLength * (1 - percentage));

  const status = getStatus(value, sensor);
  let strokeColor = "#2ecc71"; // green
  if (status === "moderate") strokeColor = "#f1c40f";
  else if (status === "bad") strokeColor = "#e74c3c";
  arc.setAttribute("stroke", strokeColor);

  reading.textContent = value.toFixed(1);
}

async function fetchChannelData(channel) {
  const url = `https://api.thingspeak.com/channels/${channel.id}/feeds.json?api_key=${channel.key}&results=1`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const latest = data.feeds[0];
    const fields = fieldMapping[channel.id];

    fields.forEach((sensor, i) => {
      const rawValue = latest[`field${i + 1}`];
      if (rawValue !== null && !isNaN(rawValue)) {
        const value = parseFloat(rawValue);

        // Handle temp/humidity directly
        if (sensor === "temperature" || sensor === "humidity") {
          const unit = sensor === "temperature" ? "°C" : "%";
          document.getElementById(sensor).textContent = `${value.toFixed(1)} ${unit}`;
        } else {
          updateSVGGauge(sensor, value);
        }
      }
    });
  } catch (err) {
    console.error("Error fetching channel:", channel.id, err);
  }
}

function fetchAllData() {
  channels.forEach(fetchChannelData);
}

document.getElementById("download-btn").addEventListener("click", async () => {
  let csv = "Channel,Date,Sensor1,Sensor2,Sensor3...\n";

  for (const channel of channels) {
    const url = `https://api.thingspeak.com/channels/${channel.id}/feeds.json?api_key=${channel.key}&results=10`;
    const res = await fetch(url);
    const data = await res.json();
    const fields = fieldMapping[channel.id];

    data.feeds.forEach(feed => {
      csv += `${channel.id},${feed.created_at}`;
      fields.forEach((_, i) => {
        csv += `,${feed[`field${i + 1}`] || ""}`;
      });
      csv += `\n`;
    });
  }

  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "air_quality_data.csv";
  link.click();
});

// Start fetching every 15s
setInterval(fetchAllData, 15000);
fetchAllData();
