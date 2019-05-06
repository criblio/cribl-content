#!/bin/bash
nc -l 9999 | grep Chewbacca &
curl -d @test.html -X POST http://localhost:10080/cribl/_bulk
sleep 15
kill %1
