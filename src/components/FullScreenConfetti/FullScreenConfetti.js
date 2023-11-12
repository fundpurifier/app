import React from 'react'
import useWindowSize from 'react-use/lib/useWindowSize'
import Confetti from 'react-confetti'

export default () => {
  const { width, height } = useWindowSize()

  // Place over the modal
  return (
    <div className='z-[101]'>
      <Confetti
        width={width}
        height={height}
      />
    </div>
  )
}