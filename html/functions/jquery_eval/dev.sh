#!/bin/bash
docker run -it -p 9000:9000 -p 10080:10080 -v `pwd`/src:/opt/cribl/bin/cribl/functions/jquery_eval -v `pwd`/test_conf:/opt/cribl/local/cribl cribl/cribl:latest
