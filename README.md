# Kindred Weave Explorer

A modern, interactive family tree explorer and relationship network visualization built with React, D3, TypeScript, and shadcn/ui. Discover, visualize, and manage your family connections with an intuitive network graph interface.

## 🌟 Features

### 📊 Interactive Network Visualization
- **D3-powered network graph** with smooth animations and physics simulation
- **Zoom, pan, and fit-to-screen** controls for easy navigation
- **Node selection and highlighting** for focused exploration
- **Stable layout** with persistent node positions to reduce movement

### 👥 Family Data Management
- **CSV import/export** with comprehensive family data templates
- **Sample data** for testing and demonstration
- **Add, edit, and delete** people and relationships
- **Multi-select node creation** - select two nodes and create relationships directly from the graph
- **Right-click context menu** for quick relationship deletion

### 🔍 Smart Search & Navigation
- **Search functionality** to quickly find and center any person in the network
- **Visual highlighting** of searched nodes
- **People tab** with detailed person cards and relationship overview

### 📤 Export & Sharing
- **High-resolution PNG export** directly from the Tree View
- **Current view capture** including zoom level and pan position
- **CSV data export** for backup and sharing

### 🐳 Deployment Ready
- **Docker support** with production-ready containerization
- **Vercel deployment** compatible
- **Static build** optimization

## 🚀 Quick Start

### Local Development
```bash
# Clone the repository
git clone https://github.com/udhaydurai/Family_Geneology.git
cd Family_Geneology

# Install dependencies
npm install

# Start development server
npm run dev
```

### Docker Deployment
```bash
# Build the Docker image
docker build -t kindred-weave-explorer .

# Run the container
docker run -p 4173:4173 kindred-weave-explorer

# Access at http://localhost:4173
```

## 📖 Usage Guide

### 1. Getting Started
- **Load Sample Data**: Click "Load Sample Data" to see the app in action
- **Download Template**: Get a CSV template for your family data
- **Upload Your Data**: Import your family information via CSV

### 2. Exploring Your Family Tree
- **Tree View**: Interactive network graph showing all relationships
- **Zoom Controls**: Use the zoom buttons or mouse wheel to navigate
- **Search**: Find specific people quickly with the search icon
- **Node Selection**: Click nodes to select them for relationship creation

### 3. Managing Relationships
- **Add Relationships**: Select two nodes and choose relationship type
- **Delete Relationships**: Right-click on relationship lines
- **Edit People**: Use the People tab to modify person details

### 4. Exporting Your Data
- **Export as PNG**: Capture the current view as a high-resolution image
- **Export as CSV**: Download your family data for backup

## 🛠️ Technical Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: shadcn/ui + Tailwind CSS
- **Visualization**: D3.js for network graphs
- **Data Export**: html2canvas for image capture
- **Containerization**: Docker with multi-stage builds
- **Deployment**: Vercel-ready static build

## 📁 Project Structure

```
src/
├── components/          # React components
│   ├── D3NetworkGraph.tsx    # Main network visualization
│   ├── DataUpload.tsx        # CSV import/export
│   ├── PersonForm.tsx        # Person management
│   └── ui/                   # shadcn/ui components
├── hooks/               # Custom React hooks
├── pages/               # Page components
├── types/               # TypeScript type definitions
└── lib/                 # Utility functions
```

## 🎨 Customization

The app uses a genealogy-themed color scheme with:
- Primary: `#8B4513` (Saddle Brown)
- Secondary: `#D2691E` (Chocolate)
- Accent colors for different relationship types

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Built with [D3.js](https://d3js.org/) for powerful data visualization
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide React](https://lucide.dev/)
- Styling with [Tailwind CSS](https://tailwindcss.com/)

---

**Discover your family connections like never before with Kindred Weave Explorer!** 🌳
