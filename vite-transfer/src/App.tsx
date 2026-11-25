import './App.css'
import { Route, Routes } from 'react-router-dom'
import Home from './pages/home'
import LoginPage from './pages/login'

function App() {
  return (
    <div style={{margin: 0}}>
      <Routes>
        <Route path="/" element={<Home />}/>
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </div>
  )
}

export default App
