import { useState } from 'react'
import logo from './logo.svg'
import './App.css'
import { Helmet } from "react-helmet";


function App(props: any) {
  const [count, setCount] = useState(0)
	const { data } = props;

	console.log('data..', data)

  return (
    <div className="App">
			<Helmet>
        <title>{`${data?.user}的页面`}</title>
				<link rel="canonical" href="http://mysite.com/example" />
      </Helmet>
    </div>
  )
}

export default App
