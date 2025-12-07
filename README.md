# 🏎️ Formula 1 Data Analyst

A comprehensive Formula 1 race analysis dashboard built with Streamlit and FastF1. This application provides deep insights into race telemetry, driver performance, tire strategies, and historical championship data.

##  Features

###  Race Analysis Dashboard
- **Full Grid Analysis**: View and analyze all 20+ drivers from any race session
- **Race Results**: Comprehensive finishing order with grid positions and status
- **Fastest Laps**: Track fastest laps per driver with compound information
- **Pace Comparison**: Box plot visualization showing lap time distribution
- **Lap Progression**: Interactive lap-by-lap timing analysis
- **Tire Strategy**: Visual representation of tire compounds used throughout the race
- **Stint Analysis**: Detailed breakdown of each driver's pit stop strategy
- **Track Maps**: Circuit layout visualization with fastest lap trace

###  Telemetry Deep Dive
- **Speed Traces**: Compare speed throughout the lap between any two drivers
- **Throttle Analysis**: Detailed throttle position comparison
- **Brake Analysis**: Brake pressure patterns and braking zones
- **Gear Usage**: Gear selection throughout the lap
- **Speed Heatmaps**: Track-based speed visualization with color coding
- **Lap Time Deltas**: Precise timing differences between drivers

###  Championship & History
- **Historical Data**: Access championship standings from 2018-2025
- **Driver Standings**: Complete driver championship with points and wins
- **Constructor Standings**: Team championship results
- **Season Calendar**: Full race calendar with dates and locations
- **Live Data**: Real-time data from Ergast API for 2018-2024
- **2025 Projections**: Projected championship standings for current season

###  Driver Comparison
- **Performance Metrics**: Head-to-head fastest lap and average pace comparison
- **Consistency Analysis**: Statistical consistency scores with standard deviation
- **Sector Performance**: Detailed sector-by-sector timing comparison
- **Sector Deltas**: Precise time differences per sector
- **Tire Degradation**: Compound-specific degradation rates analysis
- **Position Progression**: Race position changes lap-by-lap
- **Visual Comparisons**: Interactive charts and graphs

##  Installation

### Prerequisites
- Python 3.8+
- pip package manager

### Setup

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd "F1 Data Analyst"
```

2. **Install dependencies**
```bash
pip install streamlit fastf1 pandas numpy plotly
```

3. **Run the application**
```bash
streamlit run app.py
```

The application will automatically open in your default web browser at `http://localhost:8501`

## 📦 Dependencies

```
streamlit>=1.28.0
fastf1>=3.0.0
pandas>=2.0.0
numpy>=1.24.0
plotly>=5.17.0
```

##  Usage Guide

### Loading Race Data

1. **Select Season**: Choose any year from 2018-2025
2. **Select Grand Prix**: Pick from the complete season calendar
3. **Select Session**: Choose Race, Qualifying, Sprint, or Practice sessions
4. **Click LOAD DATA**: The system will fetch and cache the data

### Analyzing Telemetry

1. Navigate to the **Telemetry Deep Dive** tab
2. Select two drivers to compare
3. Choose specific lap numbers (defaults to fastest laps)
4. Explore speed traces, throttle/brake patterns, and track heatmaps

### Comparing Drivers

1. Go to the **Driver Comparison** tab
2. Select two drivers from the loaded session
3. View comprehensive performance metrics
4. Analyze sector times, consistency, and tire degradation

### Viewing Championship Data

1. Open the **Championship** tab
2. Select a season from 2018-2025
3. Browse driver standings, constructor standings, and race calendar
4. Note: 2025 data is projected, 2018-2024 is official

##  Features in Detail

### Advanced Metrics

**Consistency Score**: Calculated as `100 * (1 - std_dev / mean)` for lap times, measuring driver consistency throughout the race.

**Tire Degradation**: Measures seconds lost per lap on each tire compound, helping understand tire wear patterns.

**Sector Analysis**: Breaks down lap times into three sectors, identifying where drivers gain or lose time.

**Stint Performance**: Analyzes each stint's average pace, tire compound, and lap count.

##  Technical Architecture

### Data Sources
- **FastF1**: Primary telemetry and timing data source
- **Ergast API**: Historical championship standings
- **Local Cache**: Automatic caching system for faster subsequent loads

### Performance Optimization
- **Streamlit Caching**: 24-hour cache for API data, 10-minute cache for session data
- **FastF1 Cache**: Persistent disk cache for telemetry data
- **Efficient Data Processing**: Pandas operations optimized for large datasets

### UI/UX Design
- **Dark Theme**: Professional F1-inspired dark color scheme
- **Responsive Layout**: Adapts to different screen sizes
- **Interactive Charts**: Plotly-powered visualizations with hover details
- **Real-time Feedback**: Loading indicators and status messages

##  Data Availability

### Available Data by Year
- **2018-2024**: Full official data via FastF1 and Ergast API
- **2025**: Projected championship data + any completed race sessions
- **Sessions**: All Race, Qualifying, Sprint, and Practice sessions

### Telemetry Availability
- Most race sessions from 2018 onwards include full telemetry
- Some older sessions may have limited telemetry data
- Practice sessions may have partial telemetry coverage

##  Troubleshooting

### Common Issues

**"Session data not available"**
- Some older races may not have complete data
- Try a different session (Race vs Qualifying)
- Check internet connection for API access

**"Telemetry data not available"**
- Not all sessions include telemetry
- Try selecting a more recent race
- Ensure FastF1 cache is properly configured

**Slow loading times**
- First load of a session is slower (downloading data)
- Subsequent loads use cached data and are much faster
- Consider using a different internet connection if downloads fail

##  Configuration

### Cache Directory
The application uses a local cache directory to store downloaded data:
```python
CACHE_DIR = "cache"
```

To clear the cache and force fresh downloads, delete the `cache` directory.

### Color Scheme
Driver colors are automatically fetched from FastF1's official color scheme. To customize:
```python
def get_color(driver, session):
    # Add custom color logic here
    return fastf1.plotting.get_driver_color(driver, session=session)
```

##  Future Enhancements

Potential features for future versions:
- [ ] Qualifying lap comparison tool
- [ ] Race strategy simulator
- [ ] Weather impact analysis
- [ ] Pit stop performance metrics
- [ ] Team radio transcripts integration
- [ ] Machine learning race predictions
- [ ] Export data to CSV/Excel
- [ ] Custom color themes
- [ ] Mobile-optimized layout

##  Contributing

Contributions are welcome! Areas for improvement:
- Additional visualizations
- Performance optimizations
- Bug fixes
- Documentation improvements
- New analysis features

##  License

This project is for educational and analytical purposes. Formula 1 and related trademarks are property of Formula One Licensing BV.

##  Acknowledgments

- **FastF1**: Incredible library providing access to F1 data
- **Ergast API**: Comprehensive historical F1 statistics
- **Streamlit**: Excellent framework for data applications
- **Plotly**: Beautiful interactive visualizations
- **F1 Community**: For the passion that drives these projects

##  Support

For issues, questions, or suggestions:
1. Check the troubleshooting section above
2. Review FastF1 documentation: https://docs.fastf1.dev/
3. Open an issue in the repository

---

*Last updated: December 2024*

