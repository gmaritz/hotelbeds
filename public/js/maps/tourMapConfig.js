// Tour Map Configuration - Simplified for 400x400 Google Hybrid maps only

const mapStyles = {
  // Google Hybrid tile style only
  tileStyles: {
    googleHybrid: {
      url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      attribution: '&copy; Google'
    }
  },
  
  // Custom marker styles
  markerStyles: {
    default: {
      radius: 8,
      fillColor: '#ff7800',
      color: '#000',
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    },
    highlight: {
      radius: 12,
      fillColor: '#ff0000',
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    }
  },
  
  // Map configuration
  defaultOptions: {
    zoomControl: true,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    boxZoom: true
  }
};

// TourMap Class for handling tour map functionality
class TourMap {
  constructor(containerId, stops, options = {}) {
    this.containerId = containerId;
    this.stops = stops;
    this.options = { ...mapStyles.defaultOptions, ...options };
    this.init();
  }

  init() {
    if (!this.stops.length) {
      document.getElementById(this.containerId).innerHTML = 'No stops available for this tour.';
      return;
    }

    // Calculate center point of all stops for better initial positioning
    const centerLat = this.stops.reduce((sum, stop) => sum + stop.lat, 0) / this.stops.length;
    const centerLng = this.stops.reduce((sum, stop) => sum + stop.lng, 0) / this.stops.length;

    this.map = L.map(this.containerId, this.options)
      .setView([centerLat, centerLng], 10);

    this.addTileLayer();
    this.addMarkers();
    this.fitBounds();
  }

  addTileLayer() {
    // Always use Google Hybrid
    const tileStyle = mapStyles.tileStyles.googleHybrid;
    L.tileLayer(tileStyle.url, {
      attribution: tileStyle.attribution
    }).addTo(this.map);
  }

  addMarkers() {
    this.bounds = [];
    this.stops.forEach((stop, index) => {
      const marker = L.marker([stop.lat, stop.lng]).addTo(this.map);
      
      // Add popup for click
      marker.bindPopup(`<b>${stop.name}</b><br>${stop.description || ''}`);
      
      // Add tooltip for hover - shows just the name
      marker.bindTooltip(stop.name, {
        permanent: false,
        direction: 'top',
        offset: [0, -10],
        className: 'custom-tooltip'
      });
      
      this.bounds.push([stop.lat, stop.lng]);
    });
  }

  fitBounds() {
    if (this.bounds.length > 1) {
      // Add padding to ensure all markers are clearly visible in 400x400 size
      this.map.fitBounds(this.bounds, {
        padding: [20, 20], // 20px padding on all sides
        maxZoom: 11 // Prevent zooming in too much for small areas
      });
    } else if (this.bounds.length === 1) {
      // For single marker, set a reasonable zoom level
      this.map.setView(this.bounds[0], 12);
    }
  }
}