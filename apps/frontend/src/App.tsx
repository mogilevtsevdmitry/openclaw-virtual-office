import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginForm } from '@features/auth/LoginForm'
import { PrivateRoute } from '@features/auth/PrivateRoute'
import { OfficeApp } from '@features/office/OfficeApp'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route element={<PrivateRoute />}>
          <Route path="/office" element={<OfficeApp />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
